import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { LeaseStore } from "./ports";

// Keeps today's `tenants` documents, so the dashboard reads them unchanged.
export function createFirestoreStore(db: Firestore): LeaseStore {
  const tenants = db.collection("tenants");

  return {
    async createSigningLink(record) {
      const ref = await tenants.add({
        ...record,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    },

    async getSigningLink(id) {
      const snap = await tenants.doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data()!;
      return {
        unitType: data.unitType,
        unitNumber: data.unitNumber,
        rent: String(data.rent),
        isSigned: data.isSigned === true,
      };
    },

    async signOnce(id, { submittedAt, ...details }) {
      const ref = tenants.doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return "not_found";
        if (snap.data()!.isSigned === true) return "already_signed";
        tx.update(ref, {
          ...details,
          isSigned: true,
          status: "active",
          submittedAt: Timestamp.fromDate(submittedAt),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return "signed";
      });
    },
  };
}
