import { Clock, LeaseStore, Mailer, SignResult } from "./ports";
import { landlordNoticeEmail, signingLinkEmail, tenantConfirmationEmail } from "./emails";
import { planMigration } from "./legacy";
import {
  CarDeclaration,
  currentLease,
  dateInSouthAfrica,
  dateOfBirthFromSAId,
  firstLeaseEndDate,
  isRealDate,
  latestDocumentVersion,
  LeaseDocumentVersion,
  LeaseRecord,
  leaseState,
  needsDepositAndParking,
  PARKING_BAYS,
  Stored,
  TenantRecord,
  TenantState,
} from "./model";
import {
  findSubmissionError,
  findTenantDetailsError,
  isValidEmail,
  SubmissionFields,
  TenantDetailsFields,
} from "./validation";
import {
  DashboardRow,
  DocumentView,
  LeaseScheduleView,
  LeaseView,
  MigrationReport,
  SignatureView,
  TenantView,
} from "./views";

export interface LeaseModuleDeps {
  store: LeaseStore;
  mailer: Mailer;
  clock: Clock;
  landlordEmail: string;
  appUrl: string;
  // Read only: the module offers no way to change or remove a version.
  documentVersions: readonly LeaseDocumentVersion[];
}

export interface NewSigningLink {
  unitType: string;
  unitNumber: string;
  rent: string;
  startDate: string; // YYYY-MM-DD
  deposit: string;
  parkingReservation: boolean;
}

export interface TenantChanges extends TenantDetailsFields {
  state: TenantState;
}

export class InvalidSigningLinkError extends Error {}

export type OpenResult =
  | { status: "open"; document: DocumentView; schedule: LeaseScheduleView }
  | { status: "not_found" }
  | { status: "already_signed" };

export function createLeaseModule({ store, mailer, clock, landlordEmail, appUrl, documentVersions }: LeaseModuleDeps) {
  const today = () => dateInSouthAfrica(clock.now());

  const documentVersion = (version: number) => {
    const found = documentVersions.find((v) => v.version === version);
    if (!found) throw new Error(`Lease Document Version ${version} is not registered.`);
    return found;
  };

  // A bay is taken by a Current Tenant's Parking Reservation, or promised to whoever
  // signs an open first Lease that comes with one.
  const reservedBays = async () => {
    const [tenants, leases] = await Promise.all([store.listTenants(), store.listLeases()]);
    const held = tenants.filter((t) => t.state === "current" && t.parkingReservation === true).length;
    const promised = leases.filter((l) => l.tenantId === null && l.newTenant?.parkingReservation).length;
    return held + promised;
  };

  const signingLinkUrl = (id: string) => `${appUrl}/lease/sign/${encodeURIComponent(id)}`;

  return {
    async createSigningLink(input: NewSigningLink): Promise<{ id: string }> {
      if (!["Flat", "House"].includes(input.unitType)) throw new InvalidSigningLinkError("Unit type must be Flat or House.");
      if (!input.unitNumber?.trim()) throw new InvalidSigningLinkError("Please enter a unit number.");
      if (!(Number(input.rent) > 0)) throw new InvalidSigningLinkError("Rent must be a number above zero.");
      if (!isRealDate(input.startDate)) throw new InvalidSigningLinkError("Please enter a start date.");
      if (input.deposit?.trim() === "" || !(Number(input.deposit) >= 0)) {
        throw new InvalidSigningLinkError("Deposit must be a number, zero or more.");
      }
      if (input.parkingReservation && (await reservedBays()) >= PARKING_BAYS) {
        throw new InvalidSigningLinkError("Both Parking Bays are already reserved.");
      }

      const document = latestDocumentVersion(documentVersions, today());
      if (!document) throw new Error("No Lease Document Version is in effect yet.");

      const id = await store.createLease({
        tenantId: null,
        unitType: input.unitType,
        unitNumber: input.unitNumber.trim(),
        rent: Number(input.rent),
        startDate: input.startDate,
        endDate: firstLeaseEndDate(input.startDate),
        documentVersion: document.version,
        newTenant: { depositPaid: Number(input.deposit), parkingReservation: input.parkingReservation === true },
        carDeclaration: null,
        signature: null,
        createdAt: clock.now(),
      });
      return { id };
    },

    // The landlord sends an unsigned Signing Link to the Tenant by email.
    async emailSigningLink(id: string, to: string): Promise<EmailLinkOutcome> {
      if (!isValidEmail(to?.trim() ?? "")) return { status: "invalid", error: "Please enter a valid email address." };
      const lease = await store.getLease(id);
      if (!lease) return { status: "not_found" };
      if (lease.signature) return { status: "already_signed" };

      await mailer.send(signingLinkEmail({ to: to.trim(), url: signingLinkUrl(id), lease, landlordEmail }));
      return { status: "sent" };
    },

    // An open link offers the Lease Document Version that Lease is signed on, and
    // shows the Lease Schedule the landlord set.
    async openSigningLink(id: string): Promise<OpenResult> {
      const lease = await store.getLease(id);
      if (!lease) return { status: "not_found" };
      if (lease.signature) return { status: "already_signed" };
      return {
        status: "open",
        document: documentView(documentVersion(lease.documentVersion)),
        schedule: scheduleView(lease),
      };
    },

    async signLease(id: string, submission: Submission): Promise<SignOutcome> {
      const signedAt = clock.now();
      const signedOn = dateInSouthAfrica(signedAt);
      const error = findSubmissionError(submission, signedOn);
      if (error) return { status: "invalid", error };

      const lease = await store.getLease(id);
      if (!lease) return { status: "not_found" };

      const passport = submission.identityType === "passport";
      const tenant: TenantRecord = {
        name: submission.fullName.trim(),
        email: submission.email.trim(),
        phone: submission.phone,
        identityNumberType: passport ? "passport" : "sa_id",
        identityNumber: submission.idNumber.trim(),
        passportCountry: passport ? submission.passportCountry.trim() : null,
        dateOfBirth: passport ? submission.dateOfBirth : dateOfBirthFromSAId(submission.idNumber, signedOn),
        depositPaid: lease.newTenant?.depositPaid ?? null,
        parkingReservation: lease.newTenant?.parkingReservation ?? null,
        state: "current",
        movedOutOn: null,
      };
      const status = await store.signFirstLease(id, tenant, {
        carDeclaration: submission.carDeclaration as CarDeclaration,
        signature: {
          image: submission.signatureBase64,
          printedName: submission.signatureName,
          dateSigned: submission.signatureDate,
          signedAt,
        },
      });

      if (status === "signed") {
        const email = { ...submission, name: submission.fullName, signedAt, landlordEmail, appUrl };
        try {
          const documentFile = documentVersion(lease.documentVersion).file;
          await mailer.send(tenantConfirmationEmail({ ...email, documentFile }));
          await mailer.send(landlordNoticeEmail(email));
        } catch (err) {
          // The Lease is signed either way; a lost email must not undo it.
          console.error("Failed to send signing emails", err);
        }
      }
      return { status };
    },

    async listDashboard(): Promise<DashboardRow[]> {
      const [tenants, leases] = await Promise.all([store.listTenants(), store.listLeases()]);
      const now = today();
      const leasesOf = (tenantId: string) => leases.filter((l) => l.tenantId === tenantId);

      const tenantRows = tenants.map((t) => {
        const lease = currentLease(leasesOf(t.id));
        return { tenant: tenantView(t), lease: lease && leaseView(lease, now) };
      });
      const unsignedRows = leases
        .filter((l) => l.tenantId === null)
        .map((l) => ({ tenant: null, lease: leaseView(l, now) }));
      return [...tenantRows, ...unsignedRows];
    },

    async getSignature(leaseId: string): Promise<SignatureView | null> {
      const signature = (await store.getLease(leaseId))?.signature;
      return signature ? { image: signature.image, printedName: signature.printedName, dateSigned: signature.dateSigned } : null;
    },

    async updateTenant(id: string, changes: TenantChanges): Promise<UpdateOutcome> {
      if (!["current", "moved_out"].includes(changes.state)) return { status: "invalid", error: "Unknown Tenant state." };

      const tenant = await store.getTenant(id);
      if (!tenant) return { status: "not_found" };

      const error = findTenantDetailsError(changes, tenant.identityNumberType);
      if (error) return { status: "invalid", error };

      const identityNumber = changes.identityNumber.trim();
      const movingOut = changes.state === "moved_out";
      await store.updateTenant(id, {
        name: changes.name.trim(),
        email: changes.email.trim(),
        phone: changes.phone.trim(),
        identityNumber,
        // A passport Tenant's date of birth came from the form, so it stays.
        dateOfBirth:
          tenant.identityNumberType === "sa_id" ? dateOfBirthFromSAId(identityNumber, today()) : tenant.dateOfBirth,
        state: changes.state,
        movedOutOn: movingOut ? (tenant.movedOutOn ?? today()) : null,
      });
      return { status: "saved" };
    },

    async deleteTenant(id: string): Promise<DeleteOutcome> {
      if (!(await store.getTenant(id))) return { status: "not_found" };
      await store.deleteTenant(id);
      return { status: "deleted" };
    },

    // Only a first Lease nobody has signed; a signed Lease goes with its Tenant.
    async deleteSigningLink(id: string): Promise<DeleteOutcome> {
      const lease = await store.getLease(id);
      if (!lease) return { status: "not_found" };
      if (lease.signature || lease.tenantId) return { status: "signed" };
      await store.deleteLease(id);
      return { status: "deleted" };
    },

    // Turns each old `tenants` document into a Tenant and a Lease. Safe to run again.
    async migrate({ dryRun }: { dryRun: boolean }): Promise<MigrationReport> {
      const now = clock.now();
      const report: MigrationReport = { migrated: 0, skipped: 0, steps: [] };
      for (const old of await store.listLegacyRecords()) {
        const step = planMigration(old, now, dateInSouthAfrica(now));
        const outcome = dryRun ? "planned" : await store.applyMigration(step);
        if (outcome === "migrated") report.migrated++;
        if (outcome === "skipped") report.skipped++;
        report.steps.push({
          legacyId: step.legacyId,
          name: step.tenant?.name ?? "",
          becomes: step.tenant ? "Signed Lease" : "Lease Awaiting Signature",
          outcome,
        });
      }
      return report;
    },
  };
}

function tenantView(t: Stored<TenantRecord>): TenantView {
  return {
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone,
    identityNumberType: t.identityNumberType,
    identityNumber: t.identityNumber,
    passportCountry: t.passportCountry,
    dateOfBirth: t.dateOfBirth,
    depositPaid: t.depositPaid,
    parkingReservation: t.parkingReservation,
    state: t.state,
    movedOutOn: t.movedOutOn,
    needsDepositAndParking: needsDepositAndParking(t),
  };
}

function documentView(v: LeaseDocumentVersion): DocumentView {
  return { version: v.version, url: "/" + v.file.split("/").map(encodeURIComponent).join("/") };
}

// A migrated link has no dates or Deposit yet; the page shows those as blank.
function scheduleView(l: LeaseRecord): LeaseScheduleView {
  return {
    unitType: l.unitType,
    unitNumber: l.unitNumber,
    rent: l.rent,
    startDate: l.startDate,
    endDate: l.endDate,
    deposit: l.newTenant?.depositPaid ?? null,
  };
}

function leaseView(l: Stored<LeaseRecord>, today: string): LeaseView {
  return {
    id: l.id,
    unitType: l.unitType,
    unitNumber: l.unitNumber,
    rent: l.rent,
    startDate: l.startDate,
    endDate: l.endDate,
    carDeclaration: l.carDeclaration,
    state: leaseState(l, today),
    createdAt: l.createdAt.toISOString(),
  };
}

export type Submission = SubmissionFields;

export type EmailLinkOutcome =
  | { status: "sent" }
  | { status: "not_found" }
  | { status: "already_signed" }
  | { status: "invalid"; error: string };

export type SignOutcome ={ status: SignResult } | { status: "invalid"; error: string };

export type UpdateOutcome = { status: "saved" } | { status: "not_found" } | { status: "invalid"; error: string };

export type DeleteOutcome = { status: "deleted" } | { status: "not_found" } | { status: "signed" };

export type LeaseModule = ReturnType<typeof createLeaseModule>;
