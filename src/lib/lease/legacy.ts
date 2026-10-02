// The old shape of `tenants`: one document per signing, mixing the person and the Lease.
// Only the one-off migration reads it, so the old field names live here and nowhere else.
import { dateOfBirthFromSAId, LeaseRecord, TenantRecord } from "./model";

export interface LegacyRecord {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  unitType?: string;
  unitNumber?: string;
  rent?: string | number;
  status?: string;
  isSigned?: boolean;
  moveOutDate?: string | null;
  signatureBase64?: string;
  signatureName?: string;
  signatureDate?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  submittedAt?: Date | null;
}

// What one old record becomes. Both keep the old document's ID, so old Signing Links still work.
export interface MigrationStep {
  legacyId: string;
  tenant: TenantRecord | null; // null for a record nobody signed
  lease: LeaseRecord;
}

// Every Lease signed before Renewals runs to the end of the 2026 Lease Year.
export const MIGRATED_LEASE_END = "2026-12-31";

export function planMigration(old: LegacyRecord, now: Date, today: string): MigrationStep {
  const signed = old.isSigned === true;
  const lease: LeaseRecord = {
    tenantId: signed ? old.id : null,
    unitType: old.unitType ?? "",
    unitNumber: old.unitNumber ?? "",
    rent: Number(old.rent) || 0,
    startDate: null,
    endDate: signed ? MIGRATED_LEASE_END : null,
    documentVersion: 1, // the only version before Renewals
    newTenant: null,
    renews: null,
    unitMoves: [],
    carDeclaration: null, // nobody was asked before Renewals
    signature: signed
      ? {
          image: old.signatureBase64 ?? "",
          printedName: (old.signatureName ?? old.name ?? "").trim(),
          dateSigned: old.signatureDate ?? "",
          signedAt: old.submittedAt ?? old.updatedAt ?? old.createdAt ?? now,
        }
      : null,
    createdAt: old.createdAt ?? now,
    legacyId: old.id,
  };
  if (!signed) return { legacyId: old.id, tenant: null, lease };

  // "archived" was how the landlord hid people who had left.
  const movedOut = old.status === "moved_out" || old.status === "archived";
  const identityNumber = old.idNumber?.trim() ?? "";
  const tenant: TenantRecord = {
    name: old.name?.trim() ?? "",
    email: old.email?.trim() ?? "",
    phone: old.phone?.trim() ?? "",
    identityNumberType: "sa_id",
    identityNumber,
    passportCountry: null,
    dateOfBirth: dateOfBirthFromSAId(identityNumber, today),
    depositPaid: null,
    parkingReservation: null,
    state: movedOut ? "moved_out" : "current",
    movedOutOn: movedOut && old.moveOutDate ? old.moveOutDate.slice(0, 10) : null,
    legacyId: old.id,
  };
  return { legacyId: old.id, tenant, lease };
}
