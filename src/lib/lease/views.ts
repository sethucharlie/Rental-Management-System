// What the dashboard receives. Plain JSON, safe to import as types from the browser.
import { CarDeclaration, IdentityNumberType, LeaseState, TenantState } from "./model";

export interface TenantView {
  id: string;
  name: string;
  email: string;
  phone: string;
  identityNumberType: IdentityNumberType;
  identityNumber: string;
  passportCountry: string | null;
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
  carDeclaration: CarDeclaration | null;
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

// The Lease Document Version a signing page offers, and where to download it.
export interface DocumentView {
  version: number;
  url: string;
}

// The Lease Schedule a Tenant sees before signing a first Lease.
export interface LeaseScheduleView {
  unitType: string;
  unitNumber: string;
  rent: number;
  startDate: string | null;
  endDate: string | null;
  deposit: number | null;
}

export interface MigrationReport {
  migrated: number;
  skipped: number;
  steps: { legacyId: string; name: string; becomes: "Signed Lease" | "Lease Awaiting Signature"; outcome: "migrated" | "skipped" | "planned" }[];
}
