// The Lease module talks to the outside world only through these ports.
// Production wires Firestore, Gmail and the system clock; tests wire fakes.

export interface SigningLinkRecord {
  unitType: string;
  unitNumber: string;
  rent: string;
  isSigned: boolean;
}

export interface SignedDetails {
  name: string;
  email: string;
  idNumber: string;
  phone: string;
  signatureName: string;
  signatureDate: string;
  signatureBase64: string;
  submittedAt: Date;
}

export type SignResult = "signed" | "already_signed" | "not_found";

export interface LeaseStore {
  createSigningLink(record: SigningLinkRecord, now: Date): Promise<string>;
  getSigningLink(id: string): Promise<SigningLinkRecord | null>;
  // Must mark the link signed only if it is not signed yet, in one atomic step.
  signOnce(id: string, details: SignedDetails): Promise<SignResult>;
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
