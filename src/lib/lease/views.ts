// What the dashboard receives. Plain JSON, safe to import as types from the browser.
import { LeaseState, TenantState } from "./model";

export interface TenantView {
  id: string;
  name: string;
  email: string;
  phone: string;
  identityNumber: string;
  dateOfBirth: string | null;
  depositPaid: number | null;
  parkingReservation: boolean | null;
  state: TenantState;
  movedOutOn: string | null;
  needsDepositAndParking: boolean;
}

// Leaves out the signature image, which the dashboard fetches only when asked.
export interface LeaseView {
  id: string;
  unitType: string;
  unitNumber: string;
  rent: number;
  startDate: string | null;
  endDate: string | null;
  state: LeaseState;
  createdAt: string;
}

// One row per Tenant with their current Lease, plus one per first Lease nobody has signed yet.
export interface DashboardRow {
  tenant: TenantView | null;
  lease: LeaseView | null;
}

export interface SignatureView {
  image: string;
  printedName: string;
  dateSigned: string;
}

export interface MigrationReport {
  migrated: number;
  skipped: number;
  steps: { legacyId: string; name: string; becomes: "Signed Lease" | "Lease Awaiting Signature"; outcome: "migrated" | "skipped" | "planned" }[];
}
