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
  unitNumber: string; // the flat lived in now, after any Unit Move
  movedFrom: string | null; // the flat signed for, if a Unit Move changed it
  rent: number;
  startDate: string | null;
  endDate: string | null;
  carDeclaration: CarDeclaration | null;
  state: LeaseState;
  createdAt: string;
}

// One row per Tenant with their current Lease, plus one per first Lease nobody has signed yet.
// `renewal` is the Tenant's Renewal Signing Link while it waits for their signature.
// The two flags are only ever set for a Current Tenant.
export interface DashboardRow {
  tenant: TenantView | null;
  lease: LeaseView | null;
  renewal: LeaseView | null;
  renewalSentNotSigned: boolean;
  monthToMonth: boolean; // their latest signed Lease has Ended
  history: LeaseView[]; // all their Leases, newest first
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

// The Parking Bays: the Current Tenants holding a Parking Reservation, and how many bays
// are promised to first Leases nobody has signed yet.
export interface ParkingView {
  bays: number;
  holders: { tenantId: string; name: string }[];
  promisedToUnsignedLinks: number;
}

// What a Renewal page pre-fills for the Tenant to check, once they give their Identity Number.
export interface RenewalTenantView {
  name: string;
  email: string;
  phone: string;
  identityNumberType: IdentityNumberType;
  identityNumber: string;
  passportCountry: string | null;
  dateOfBirth: string | null;
  parkingReservation: boolean; // a "no car" Car Declaration ends it
}

export interface MigrationReport {
  migrated: number;
  skipped: number;
  steps: { legacyId: string; name: string; becomes: "Signed Lease" | "Lease Awaiting Signature"; outcome: "migrated" | "skipped" | "planned" }[];
}
