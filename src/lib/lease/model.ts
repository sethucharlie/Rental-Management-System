// Tenants and Leases (ADR 0001). A Tenant is the person; each Lease is one agreement
// for one Lease Year. Pure code: no Firestore, no clock.

export type TenantState = "current" | "moved_out";
export type LeaseState = "awaiting_signature" | "signed" | "ended";
export type IdentityNumberType = "sa_id" | "passport";
export type CarDeclaration = "car" | "no_car";

export interface TenantRecord {
  name: string;
  email: string;
  phone: string;
  identityNumberType: IdentityNumberType;
  identityNumber: string;
  passportCountry: string | null; // the issuing country; null for an SA ID
  dateOfBirth: string | null; // YYYY-MM-DD
  depositPaid: number | null; // null until the landlord records it
  parkingReservation: boolean | null; // null until the landlord records it
  state: TenantState;
  movedOutOn: string | null; // YYYY-MM-DD
  legacyId?: string; // the old `tenants` document this Tenant was migrated from
}

export interface LeaseSignature {
  image: string; // PNG data URL
  printedName: string;
  dateSigned: string; // as the Tenant wrote it
  signedAt: Date;
}

export interface LeaseRecord {
  tenantId: string | null; // null until someone signs a first Lease
  unitType: string;
  unitNumber: string;
  rent: number;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  documentVersion: number; // the Lease Document Version it is signed on
  // What the landlord set for whoever signs this first Lease. Copied onto the new Tenant
  // at signing. null on a migrated Lease.
  newTenant: NewTenantTerms | null;
  renews: string | null; // on a Renewal, the Lease it renews; null on a first Lease
  carDeclaration: CarDeclaration | null; // null until signed, and on a migrated Lease
  signature: LeaseSignature | null;
  createdAt: Date;
  legacyId?: string;
  identityGuard?: IdentityGuard; // Renewals only; missing means no wrong tries yet
}

// Counts wrong Identity Numbers entered on a Renewal Signing Link.
export interface IdentityGuard {
  failures: number; // since the last block or right answer
  blockedUntil: Date | null;
}

export const MAX_IDENTITY_TRIES = 5;
export const IDENTITY_BLOCK_MINUTES = 15;

export interface NewTenantTerms {
  depositPaid: number;
  parkingReservation: boolean;
}

export const PARKING_BAYS = 2;

// A first Lease ends on 31 December, or on 31 December of the next year if it starts
// on or after 1 November. Takes and gives YYYY-MM-DD.
export function firstLeaseEndDate(startDate: string): string {
  const year = Number(startDate.slice(0, 4));
  const month = Number(startDate.slice(5, 7));
  return `${month >= 11 ? year + 1 : year}-12-31`;
}

export function isRealDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

// One edition of the Lease Document's wording (ADR 0002). Versions are only ever added.
export interface LeaseDocumentVersion {
  version: number;
  file: string; // path under public/
  changeNote: string; // the landlord's short note of what it changed
  effectiveFrom: string; // YYYY-MM-DD
}

// The newest version in effect on the given day. New Signing Links use it.
export function latestDocumentVersion(
  versions: readonly LeaseDocumentVersion[],
  today: string,
): LeaseDocumentVersion | null {
  return versions
    .filter((v) => v.effectiveFrom <= today)
    .reduce<LeaseDocumentVersion | null>((latest, v) => (!latest || v.version > latest.version ? v : latest), null);
}

export type Stored<T> = T & { id: string };

// Leases follow the calendar in South Africa, whatever the server's time zone.
export const dateInSouthAfrica = (at: Date) => at.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

// A Lease counts as Ended the day after its end date. The app works this out; it never stores it.
export function leaseState(lease: LeaseRecord, today: string): LeaseState {
  if (!lease.signature) return "awaiting_signature";
  if (lease.endDate && today > lease.endDate) return "ended";
  return "signed";
}

export const needsDepositAndParking = (tenant: TenantRecord) =>
  tenant.depositPaid === null || tenant.parkingReservation === null;

// An SA ID starts YYMMDD. A birth date that would lie in the future belongs to the 1900s.
export function dateOfBirthFromSAId(idNumber: string, today: string): string | null {
  const match = /^(\d{2})(\d{2})(\d{2})/.exec(idNumber);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  let date = `20${yy}-${mm}-${dd}`;
  if (date > today) date = `19${yy}-${mm}-${dd}`;
  return isRealDate(date) ? date : null;
}

// The signed Lease that ends last is the current one; an open Renewal does not replace it
// until signed. With nothing signed, the newest Lease.
export function currentLease<T extends LeaseRecord>(leases: T[]): T | null {
  const signed = leases.filter((l) => l.signature);
  if (!signed.length) return newest(leases);
  return signed.reduce((last, l) => ((l.endDate ?? "") > (last.endDate ?? "") ? l : last));
}

// The Renewal waiting for this Tenant's signature, if any.
export function openRenewal<T extends LeaseRecord>(leases: T[]): T | null {
  return newest(leases.filter((l) => l.renews && !l.signature));
}

function newest<T extends LeaseRecord>(leases: T[]): T | null {
  return leases.reduce<T | null>((latest, l) => (!latest || l.createdAt > latest.createdAt ? l : latest), null);
}

// A Renewal covers the whole Lease Year after the one its current Lease ends in.
export function renewalPeriod(currentEndDate: string): { startDate: string; endDate: string } {
  const year = Number(currentEndDate.slice(0, 4)) + 1;
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

// Renewal Signing Links should go out from 7 September to 3 November, the Consumer
// Protection Act notice window for a Lease ending 31 December. Takes YYYY-MM-DD.
export function isInRenewalWindow(today: string): boolean {
  const monthDay = today.slice(5);
  return monthDay >= "09-07" && monthDay <= "11-03";
}

// Identity Numbers match whatever the spaces or letter case.
export const sameIdentityNumber = (a: string, b: string) => {
  const normal = (n: string) => n.replace(/\s+/g, "").toUpperCase();
  return normal(a) !== "" && normal(a) === normal(b);
};
