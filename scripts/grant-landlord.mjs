// Marks each Google account in LANDLORD_EMAILS as the landlord (the `landlord`
// custom claim that firestore.rules and the server check). Run it once, and
// again whenever LANDLORD_EMAILS changes. Each account must have signed in to
// the dashboard at least once, and must sign out and in again afterwards.
import nextEnv from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

nextEnv.loadEnvConfig(process.cwd());

const emails = (process.env.LANDLORD_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
if (emails.length === 0) {
  console.error("LANDLORD_EMAILS is empty in .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, "\n"),
  }),
});
const auth = getAuth();

let failed = false;
for (const email of emails) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, landlord: true });
    console.log(`Granted landlord to ${email}`);
  } catch (err) {
    failed = true;
    console.error(`Could not grant landlord to ${email}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
