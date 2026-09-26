// In-memory stand-ins for the Lease module's ports, for tests.
import { Clock, LeaseStore, Mailer, MailMessage, SignedDetails, SigningLinkRecord } from "./ports";

export function createMemoryStore(): LeaseStore {
  const links = new Map<string, SigningLinkRecord & Partial<SignedDetails>>();
  let nextId = 1;

  return {
    async createSigningLink(record) {
      const id = `link-${nextId++}`;
      links.set(id, { ...record });
      return id;
    },
    async getSigningLink(id) {
      const link = links.get(id);
      return link ? { ...link } : null;
    },
    async signOnce(id, details) {
      const link = links.get(id);
      if (!link) return "not_found";
      if (link.isSigned) return "already_signed";
      links.set(id, { ...link, ...details, isSigned: true });
      return "signed";
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
