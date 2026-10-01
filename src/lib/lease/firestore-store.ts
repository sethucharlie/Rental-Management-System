import { DocumentData, FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { LegacyRecord } from "./legacy";
import { LeaseRecord, Stored, TenantRecord } from "./model";
import { LeaseStore } from "./ports";

// `tenants` holds Tenants and `leases` holds Leases. A migrated Tenant and Lease keep the
// old `tenants` document's ID; the old document itself is copied to `legacyTenants` first.
export function createFirestoreStore(db: Firestore): LeaseStore {
  const tenants = db.collection("tenants");
  const leases = db.collection("leases");
  const legacyBackups = db.collection("legacyTenants");

  return {
    async createLease(lease) {
      const ref = await leases.add(leaseToDoc(lease));
      return ref.id;
    },

    async getLease(id) {
      const snap = await leases.doc(id).get();
      return snap.exists ? leaseFromDoc(snap.id, snap.data()!) : null;
    },

    async listLeases() {
      const snap = await leases.get();
      return snap.docs.map((d) => leaseFromDoc(d.id, d.data()));
    },

    async deleteLease(id) {
      await leases.doc(id).delete();
    },

    async signFirstLease(leaseId, tenant, { carDeclaration, signature }) {
      const leaseRef = leases.doc(leaseId);
      const tenantRef = tenants.doc();
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(leaseRef);
        if (!snap.exists) return "not_found";
        if (snap.data()!.signature) return "already_signed";
        tx.create(tenantRef, tenantToDoc(tenant));
        tx.update(leaseRef, {
          tenantId: tenantRef.id,
          carDeclaration,
          signature: { ...signature, signedAt: Timestamp.fromDate(signature.signedAt) },
          updatedAt: FieldValue.serverTimestamp(),
        });
        return "signed";
      });
    },

    async getTenant(id) {
      const snap = await tenants.doc(id).get();
      return snap.exists && isTenantDoc(snap.data()!) ? tenantFromDoc(snap.id, snap.data()!) : null;
    },

    async listTenants() {
      const snap = await tenants.get();
      return snap.docs.filter((d) => isTenantDoc(d.data())).map((d) => tenantFromDoc(d.id, d.data()));
    },

    async updateTenant(id, changes) {
      await tenants.doc(id).update({ ...withoutUndefined(changes), updatedAt: FieldValue.serverTimestamp() });
    },

    async deleteTenant(id) {
      const theirLeases = await leases.where("tenantId", "==", id).get();
      const batch = db.batch();
      theirLeases.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(tenants.doc(id));
      await batch.commit();
    },

    async listLegacyRecords() {
      const snap = await tenants.get();
      return snap.docs.filter((d) => !isTenantDoc(d.data())).map((d) => legacyFromDoc(d.id, d.data()));
    },

    async applyMigration({ legacyId, tenant, lease }) {
      const oldRef = tenants.doc(legacyId);
      const leaseRef = leases.doc(legacyId);
      return db.runTransaction(async (tx) => {
        const [oldSnap, leaseSnap] = await Promise.all([tx.get(oldRef), tx.get(leaseRef)]);
        if (!oldSnap.exists || isTenantDoc(oldSnap.data()!) || leaseSnap.exists) return "skipped";

        tx.set(legacyBackups.doc(legacyId), oldSnap.data()!);
        tx.create(leaseRef, leaseToDoc(lease));
        if (tenant) tx.set(oldRef, tenantToDoc(tenant));
        else tx.delete(oldRef);
        return "migrated";
      });
    },
  };
}

// Every Tenant document has a `state`; the old one-per-signing documents never did.
const isTenantDoc = (data: DocumentData) => typeof data.state === "string";

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const withoutUndefined = <T extends object>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

function leaseToDoc(lease: LeaseRecord) {
  return withoutUndefined({
    ...lease,
    signature: lease.signature && { ...lease.signature, signedAt: Timestamp.fromDate(lease.signature.signedAt) },
    createdAt: Timestamp.fromDate(lease.createdAt),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function leaseFromDoc(id: string, d: DocumentData): Stored<LeaseRecord> {
  return {
    id,
    tenantId: d.tenantId ?? null,
    unitType: d.unitType ?? "",
    unitNumber: d.unitNumber ?? "",
    rent: Number(d.rent) || 0,
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? null,
    // Leases saved before versions existed were all signed on Version 1.
    documentVersion: typeof d.documentVersion === "number" ? d.documentVersion : 1,
    newTenant: d.newTenant
      ? { depositPaid: Number(d.newTenant.depositPaid) || 0, parkingReservation: d.newTenant.parkingReservation === true }
      : null,
    carDeclaration: d.carDeclaration === "car" || d.carDeclaration === "no_car" ? d.carDeclaration : null,
    signature: d.signature
      ? {
          image: d.signature.image ?? "",
          printedName: d.signature.printedName ?? "",
          dateSigned: d.signature.dateSigned ?? "",
          signedAt: toDate(d.signature.signedAt) ?? new Date(0),
        }
      : null,
    createdAt: toDate(d.createdAt) ?? new Date(0),
    ...(d.legacyId ? { legacyId: d.legacyId } : {}),
  };
}

function tenantToDoc(tenant: TenantRecord) {
  return withoutUndefined({
    ...tenant,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function tenantFromDoc(id: string, d: DocumentData): Stored<TenantRecord> {
  return {
    id,
    name: d.name ?? "",
    email: d.email ?? "",
    phone: d.phone ?? "",
    // Tenants saved before passports existed all gave an SA ID.
    identityNumberType: d.identityNumberType === "passport" ? "passport" : "sa_id",
    identityNumber: d.identityNumber ?? "",
    passportCountry: d.passportCountry ?? null,
    dateOfBirth: d.dateOfBirth ?? null,
    depositPaid: typeof d.depositPaid === "number" ? d.depositPaid : null,
    parkingReservation: typeof d.parkingReservation === "boolean" ? d.parkingReservation : null,
    state: d.state === "moved_out" ? "moved_out" : "current",
    movedOutOn: d.movedOutOn ?? null,
    ...(d.legacyId ? { legacyId: d.legacyId } : {}),
  };
}

function legacyFromDoc(id: string, d: DocumentData): LegacyRecord {
  return {
    ...d,
    id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    submittedAt: toDate(d.submittedAt),
    moveOutDate: typeof d.moveOutDate === "string" ? d.moveOutDate : (toDate(d.moveOutDate)?.toISOString() ?? null),
  };
}
