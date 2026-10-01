// In-memory stand-ins for the Lease module's ports, for tests.
import { LegacyRecord } from "./legacy";
import { LeaseRecord, Stored, TenantRecord } from "./model";
import { Clock, LeaseStore, Mailer, MailMessage } from "./ports";

export interface MemoryStore extends LeaseStore {
  // Plants old `tenants` documents, as they were before the migration.
  addLegacyRecord(record: LegacyRecord): void;
}

export function createMemoryStore(): MemoryStore {
  const leases = new Map<string, LeaseRecord>();
  const tenants = new Map<string, TenantRecord>();
  const legacy = new Map<string, LegacyRecord>();
  const backups = new Map<string, LegacyRecord>();
  let nextId = 1;

  const copy = <T>(id: string, record: T | undefined): Stored<T> | null =>
    record ? { ...structuredClone(record), id } : null;

  return {
    addLegacyRecord(record) {
      legacy.set(record.id, structuredClone(record));
    },

    async createLease(lease) {
      const id = `lease-${nextId++}`;
      leases.set(id, structuredClone(lease));
      return id;
    },
    async getLease(id) {
      return copy(id, leases.get(id));
    },
    async listLeases() {
      return [...leases].map(([id, l]) => copy(id, l)!);
    },
    async deleteLease(id) {
      leases.delete(id);
    },
    async signFirstLease(leaseId, tenant, { carDeclaration, signature }) {
      const lease = leases.get(leaseId);
      if (!lease) return "not_found";
      if (lease.signature) return "already_signed";
      const tenantId = `tenant-${nextId++}`;
      tenants.set(tenantId, structuredClone(tenant));
      leases.set(leaseId, { ...lease, tenantId, carDeclaration, signature: structuredClone(signature) });
      return "signed";
    },

    async getTenant(id) {
      return copy(id, tenants.get(id));
    },
    async listTenants() {
      return [...tenants].map(([id, t]) => copy(id, t)!);
    },
    async updateTenant(id, changes) {
      const tenant = tenants.get(id);
      if (tenant) tenants.set(id, { ...tenant, ...structuredClone(changes) });
    },
    async deleteTenant(id) {
      tenants.delete(id);
      for (const [leaseId, l] of leases) if (l.tenantId === id) leases.delete(leaseId);
    },

    async listLegacyRecords() {
      return [...legacy.values()].map((r) => structuredClone(r));
    },
    async applyMigration({ legacyId, tenant, lease }) {
      const old = legacy.get(legacyId);
      if (!old || leases.has(legacyId)) return "skipped";
      backups.set(legacyId, old);
      legacy.delete(legacyId);
      leases.set(legacyId, structuredClone(lease));
      if (tenant) tenants.set(legacyId, structuredClone(tenant));
      return "migrated";
    },
  };
}

export interface FakeMailer extends Mailer {
  sent: MailMessage[];
}

export function createFakeMailer(): FakeMailer {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

export function fixedClock(at: Date): Clock {
  return { now: () => at };
}

// A clock the test can move forward, to see Leases end.
export function settableClock(at: Date): Clock & { set(at: Date): void } {
  let now = at;
  return { now: () => now, set: (next) => (now = next) };
}
