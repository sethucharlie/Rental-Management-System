// Wires the Lease module to Firestore, Gmail and the system clock for Route Handlers.
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { createFirestoreStore } from "./firestore-store";
import { createGmailMailer } from "./gmail-mailer";
import { createLeaseModule, LeaseModule } from "./lease-module";
import { Mailer } from "./ports";

let lease: LeaseModule | undefined;

export function getLeaseModule(): LeaseModule {
  if (lease) return lease;

  lease = createLeaseModule({
    store: createFirestoreStore(adminDb()),
    mailer: lazyGmailMailer(),
    clock: { now: () => new Date() },
    landlordEmail: process.env.EMAIL_USER?.trim() ?? "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  return lease;
}

// Missing Gmail settings should fail only the email, never opening or signing a link.
function lazyGmailMailer(): Mailer {
  let mailer: Mailer | undefined;
  return {
    async send(message) {
      if (!mailer) {
        const { EMAIL_USER, EMAIL_PASS } = process.env;
        if (!EMAIL_USER || !EMAIL_PASS) throw new Error("Server email configuration missing");
        mailer = createGmailMailer(EMAIL_USER, EMAIL_PASS);
      }
      await mailer.send(message);
    },
  };
}

// True only for a request carrying a valid Firebase ID token with the `landlord` claim,
// the same test firestore.rules applies. `npm run grant-landlord` sets the claim.
export async function isLandlordRequest(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.landlord === true;
  } catch {
    return false;
  }
}
