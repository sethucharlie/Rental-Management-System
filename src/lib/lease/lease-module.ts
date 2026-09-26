import { Clock, LeaseStore, Mailer, SignResult } from "./ports";
import { landlordNoticeEmail, tenantConfirmationEmail } from "./emails";
import { findSubmissionError, SubmissionFields } from "./validation";

export interface LeaseModuleDeps {
  store: LeaseStore;
  mailer: Mailer;
  clock: Clock;
  landlordEmail: string;
  appUrl: string;
}

export interface NewSigningLink {
  unitType: string;
  unitNumber: string;
  rent: string;
}

export class InvalidSigningLinkError extends Error {}

export type OpenResult = { status: "open" } | { status: "not_found" } | { status: "already_signed" };

export function createLeaseModule({ store, mailer, clock, landlordEmail, appUrl }: LeaseModuleDeps) {
  return {
    async createSigningLink(input: NewSigningLink): Promise<{ id: string }> {
      if (!["Flat", "House"].includes(input.unitType)) throw new InvalidSigningLinkError("Unit type must be Flat or House.");
      if (!input.unitNumber?.trim()) throw new InvalidSigningLinkError("Please enter a unit number.");
      if (!(Number(input.rent) > 0)) throw new InvalidSigningLinkError("Rent must be a number above zero.");

      const id = await store.createSigningLink({ ...input, isSigned: false }, clock.now());
      return { id };
    },

    async openSigningLink(id: string): Promise<OpenResult> {
      const link = await store.getSigningLink(id);
      if (!link) return { status: "not_found" };
      if (link.isSigned) return { status: "already_signed" };
      return { status: "open" };
    },

    async signLease(id: string, submission: Submission): Promise<SignOutcome> {
      const error = findSubmissionError(submission);
      if (error) return { status: "invalid", error };

      const signedAt = clock.now();
      const status = await store.signOnce(id, {
        name: submission.fullName,
        email: submission.email,
        idNumber: submission.idNumber,
        phone: submission.phone,
        signatureName: submission.signatureName,
        signatureDate: submission.signatureDate,
        signatureBase64: submission.signatureBase64,
        submittedAt: signedAt,
      });

      if (status === "signed") {
        const email = { ...submission, name: submission.fullName, signedAt, landlordEmail, appUrl };
        try {
          await mailer.send(tenantConfirmationEmail(email));
          await mailer.send(landlordNoticeEmail(email));
        } catch (err) {
          // The Lease is signed either way; a lost email must not undo it.
          console.error("Failed to send signing emails", err);
        }
      }
      return { status };
    },
  };
}

export type Submission = SubmissionFields;

export type SignOutcome = { status: SignResult } | { status: "invalid"; error: string };

export type LeaseModule = ReturnType<typeof createLeaseModule>;
