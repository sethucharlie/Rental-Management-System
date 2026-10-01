// The Lease module talks to the outside world only through these ports.
// Production wires Firestore, Gmail and the system clock; tests wire fakes.
import { LegacyRecord, MigrationStep } from "./legacy";
import { CarDeclaration, LeaseRecord, LeaseSignature, Stored, TenantRecord } from "./model";

export type SignResult = "signed" | "already_signed" | "not_found";

export interface LeaseStore {
  createLease(lease: LeaseRecord): Promise<string>;
  getLease(id: string): Promise<Stored<LeaseRecord> | null>;
  listLeases(): Promise<Stored<LeaseRecord>[]>;
  deleteLease(id: string): Promise<void>;
  // In one atomic step, and only if the Lease is not signed yet: create the Tenant,
  // link the Lease to them and save the Car Declaration and signature.
  signFirstLease(
    leaseId: string,
    tenant: TenantRecord,
    signing: { carDeclaration: CarDeclaration; signature: LeaseSignature },
  ): Promise<SignResult>;

  getTenant(id: string): Promise<Stored<TenantRecord> | null>;
  listTenants(): Promise<Stored<TenantRecord>[]>;
  updateTenant(id: string, changes: Partial<TenantRecord>): Promise<void>;
  // Deletes the Tenant and all their Leases.
  deleteTenant(id: string): Promise<void>;

  // Old `tenants` documents not migrated yet.
  listLegacyRecords(): Promise<LegacyRecord[]>;
  // In one atomic step: keep a copy of the old record, then write the step.
  // Skips a record already migrated, so running the migration twice is safe.
  applyMigration(step: MigrationStep): Promise<"migrated" | "skipped">;
}

export interface MailAttachment {
  filename: string;
  path: string;
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface Clock {
  now(): Date;
}
