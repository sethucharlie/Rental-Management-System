import { Clock, LeaseStore, Mailer, SignResult } from "./ports";
import { landlordNoticeEmail, tenantConfirmationEmail } from "./emails";
import { planMigration } from "./legacy";
import {
  currentLease,
  dateInSouthAfrica,
  dateOfBirthFromSAId,
  LeaseRecord,
  leaseState,
  needsDepositAndParking,
  Stored,
  TenantRecord,
  TenantState,
} from "./model";
import { findSubmissionError, findTenantDetailsError, SubmissionFields, TenantDetailsFields } from "./validation";
import { DashboardRow, LeaseView, MigrationReport, SignatureView, TenantView } from "./views";

export interface LeaseModuleDeps {
  store: LeaseStore;
  mailer: Mailer;
  clock: Clock;
  landlordEmail: string;
  appUrl: string;
}

export interface NewSigningLink {
  unitType: string;
  unitNumber: string;
  rent: string;
}

export interface TenantChanges extends TenantDetailsFields {
  state: TenantState;
}

export class InvalidSigningLinkError extends Error {}

export type OpenResult = { status: "open" } | { status: "not_found" } | { status: "already_signed" };

export function createLeaseModule({ store, mailer, clock, landlordEmail, appUrl }: LeaseModuleDeps) {
  const today = () => dateInSouthAfrica(clock.now());

  return {
    async createSigningLink(input: NewSigningLink): Promise<{ id: string }> {
      if (!["Flat", "House"].includes(input.unitType)) throw new InvalidSigningLinkError("Unit type must be Flat or House.");
      if (!input.unitNumber?.trim()) throw new InvalidSigningLinkError("Please enter a unit number.");
      if (!(Number(input.rent) > 0)) throw new InvalidSigningLinkError("Rent must be a number above zero.");

      const id = await store.createLease({
        tenantId: null,
        unitType: input.unitType,
        unitNumber: input.unitNumber.trim(),
        rent: Number(input.rent),
        startDate: null,
        endDate: null,
        signature: null,
        createdAt: clock.now(),
      });
      return { id };
    },

    async openSigningLink(id: string): Promise<OpenResult> {
      const lease = await store.getLease(id);
      if (!lease) return { status: "not_found" };
      if (lease.signature) return { status: "already_signed" };
      return { status: "open" };
    },

    async signLease(id: string, submission: Submission): Promise<SignOutcome> {
      const error = findSubmissionError(submission);
      if (error) return { status: "invalid", error };

      const signedAt = clock.now();
      const tenant: TenantRecord = {
        name: submission.fullName.trim(),
        email: submission.email.trim(),
        phone: submission.phone,
        identityNumberType: "sa_id",
        identityNumber: submission.idNumber,
        dateOfBirth: dateOfBirthFromSAId(submission.idNumber, dateInSouthAfrica(signedAt)),
        depositPaid: null,
        parkingReservation: null,
        state: "current",
        movedOutOn: null,
      };
      const status = await store.signFirstLease(id, tenant, {
        image: submission.signatureBase64,
        printedName: submission.signatureName,
        dateSigned: submission.signatureDate,
        signedAt,
      });

      if (status === "signed") {
        const email = { ...submission, name: submission.fullName, signedAt, landlordEmail, appUrl };
        try {
          await mailer.send(tenantConfirmationEmail(email));
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
      const error = findTenantDetailsError(changes);
      if (error) return { status: "invalid", error };
      if (!["current", "moved_out"].includes(changes.state)) return { status: "invalid", error: "Unknown Tenant state." };

      const tenant = await store.getTenant(id);
      if (!tenant) return { status: "not_found" };

      const identityNumber = changes.identityNumber.trim();
      const movingOut = changes.state === "moved_out";
      await store.updateTenant(id, {
        name: changes.name.trim(),
        email: changes.email.trim(),
        phone: changes.phone.trim(),
        identityNumber,
        dateOfBirth: dateOfBirthFromSAId(identityNumber, today()),
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
    identityNumber: t.identityNumber,
    dateOfBirth: t.dateOfBirth,
    depositPaid: t.depositPaid,
    parkingReservation: t.parkingReservation,
    state: t.state,
    movedOutOn: t.movedOutOn,
    needsDepositAndParking: needsDepositAndParking(t),
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
    state: leaseState(l, today),
    createdAt: l.createdAt.toISOString(),
  };
}

export type Submission = SubmissionFields;

export type SignOutcome = { status: SignResult } | { status: "invalid"; error: string };

export type UpdateOutcome = { status: "saved" } | { status: "not_found" } | { status: "invalid"; error: string };

export type DeleteOutcome = { status: "deleted" } | { status: "not_found" } | { status: "signed" };

export type LeaseModule = ReturnType<typeof createLeaseModule>;
