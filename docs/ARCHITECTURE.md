# Architecture — Lease Management System

This document describes the technical architecture, data model, component structure, and key design decisions behind the system.

---

## Overview

The system is split into two user-facing surfaces:

| Surface | Path | Audience |
|---|---|---|
| Admin Portal | `/login`, `/dashboard/*` | Property manager |
| Tenant Signing Page | `/lease/sign/[tenantId]` | Tenant |

All data is persisted in **Firebase Firestore**. Authentication uses **Firebase Auth** with Google Sign-In. There is no separate backend server. The browser never touches Firestore: the dashboard and the signing page both call Next.js Route Handlers, which call the **Lease module** on the server.

---

## Authentication Flow

```
User visits /dashboard/*
        │
        ▼
DashboardLayout checks useAuth()
        │
  user == null?
    ├── YES → redirect to /login
    └── NO  → render page
        │
/login page
  → signInWithPopup(GoogleAuthProvider)
  → onSuccess → router.push("/dashboard/tenants")
```

- `AuthProvider` (`src/lib/auth-context.tsx`) wraps the entire app in `RootLayout`
- It subscribes to `onAuthStateChanged` and exposes `{ user, loading }` via React Context
- `DashboardLayout` (`src/app/dashboard/layout.tsx`) reads this context and redirects unauthenticated users

---

## Data Model

### Firestore collections

The app splits the person from each agreement they sign (ADR 0001). The code lives in `src/lib/lease/model.ts`.

**`tenants`**: one document per Tenant, the person.

```typescript
interface TenantRecord {
  name: string;
  email: string;
  phone: string;
  identityNumberType: "sa_id";
  identityNumber: string;
  dateOfBirth: string | null;          // YYYY-MM-DD, from the SA ID
  depositPaid: number | null;          // null until the landlord records it
  parkingReservation: boolean | null;  // null until the landlord records it
  state: "current" | "moved_out";
  movedOutOn: string | null;           // YYYY-MM-DD
  legacyId?: string;                   // set on migrated Tenants
}
```

**`leases`**: one document per Lease. The Lease's ID is also its Signing Link: `/lease/sign/{leaseId}`.

```typescript
interface LeaseRecord {
  tenantId: string | null;   // null until someone signs a first Lease
  unitType: string;          // "Flat" | "House"
  unitNumber: string;
  rent: number;
  startDate: string | null;  // YYYY-MM-DD
  endDate: string | null;    // YYYY-MM-DD
  signature: { image: string; printedName: string; dateSigned: string; signedAt: Timestamp } | null;
  createdAt: Timestamp;
  legacyId?: string;
}
```

The app works out two things instead of storing them:

- **Lease state.** Awaiting Signature until signed, then Signed, then Ended from the day after `endDate`, going by the date in Johannesburg.
- **Needs Deposit and parking.** A Tenant whose `depositPaid` or `parkingReservation` is still `null`.

**`legacyTenants`**: a copy of each old one-document-per-signing record, kept by the migration. Nothing reads it.

### Migrating the old records

Before this split, `tenants` held one document per signing. `npm run migrate-tenants` converts them, one transaction per record:

- A signed record becomes a Tenant and a Signed Lease ending 31 December 2026. Both keep the old document's ID, so the old Signing Link still shows "Already Signed". Records marked moved out or archived become Moved Out Tenants.
- An unsigned record becomes a Lease Awaiting Signature with the old ID, so its link can still be signed. No Tenant exists until someone signs it.
- Each old document is copied to `legacyTenants` first. A record whose Lease already exists is skipped, so a second run changes nothing.

Run `npm run migrate-tenants -- --dry-run` first to see what it would do. It needs the same `.env.local` as the server.

### Key Design Decisions

**Master PDF in Public Folder:**
The lease document (`public/LEASE AGREEMENT updated.01.pdf`) is a static file in `public/`. This avoids Firebase Storage. The signing page offers it for download, and the Tenant's confirmation email attaches it.

**Signature stored as base64 in Firestore:**
The signature is a PNG exported from the canvas as a data URL (base64 string) and saved directly in the Firestore document. Signature images are typically 20–50KB — well within Firestore's 1MB document limit. This completely removes the need for Firebase Storage.

**Signing runs on the server:**
Neither the signing page nor the dashboard touches Firestore. They call Route Handlers, which call the Lease module (`src/lib/lease/`). The module checks every field again, signs a Lease inside a Firestore transaction (so a link can be signed only once, and the signer becomes a Tenant in the same step), and sends the emails. Dashboard routes first check the landlord's ID token. Route Handlers use the `firebase-admin` SDK, which bypasses the Firestore rules, so the rules can close all public access.

**The Lease module and its ports:**
The module holds the rules and talks to the outside only through three ports: a store, a mailer and a clock. Production wires Firestore (`firestore-store.ts`), Gmail through nodemailer (`gmail-mailer.ts`) and the system clock (`server.ts`). Tests wire an in-memory store, a fake mailer and a fixed clock (`testing.ts`). Run the tests with `npm test`.

---

## Component Map

```
src/components/
│
├── SignaturePad.tsx
│     A forwardRef wrapper around react-signature-canvas.
│     Exposes: clear(), isEmpty(), toDataURL()
│     Used by: /lease/sign/[tenantId]/page.tsx
│
├── SignatureViewModal.tsx
│     Renders the tenant's base64 signature as an <img>.
│     Also shows printed name and date signed.
│     Used by: /dashboard/tenants/page.tsx
│
├── EditTenantModal.tsx
│     Form modal for the landlord to edit a Tenant's name, ID number,
│     phone, email and state (Current or Moved Out).
│     Saves through PATCH /api/tenants/{id}.
│     Used by: /dashboard/tenants/page.tsx
│
└── ConfirmDeleteModal.tsx
      Confirmation dialog before permanently deleting a tenant record.
      Deletes through DELETE /api/tenants/{id} (the Tenant and all their
      Leases) or DELETE /api/signing-links/{id} (an unsigned link).
      Used by: /dashboard/tenants/page.tsx
```

---

## Page Map

### `/login`
- Google Sign-In via `signInWithPopup`
- On success: redirects to `/dashboard/tenants`

### `/dashboard/layout.tsx`
- Auth guard: redirects to `/login` if no user
- Renders sticky top navigation bar with active-link highlighting
- Renders mobile bottom tab bar
- Wraps all `/dashboard/*` pages

### `/dashboard/tenants`
- Loads `GET /api/tenants`: one row per Tenant with their current (newest) Lease, plus one row per first Lease nobody has signed yet
- Shows Tenant state, Lease state and end date, and marks Tenants whose Deposit and parking are not recorded
- Features: search by name, filter by Tenant state, Lease state and unit, sort by name or date
- Row actions: edit Tenant, view signature (`GET /api/leases/{id}/signature`), copy an unsigned Signing Link, delete

### `/dashboard/create-tenant`
- Admin form: Unit Type, Unit Number, Rent
- On submit: `POST /api/signing-links` with the landlord's Firebase ID token. The server checks the token carries the `landlord` claim and the fields are valid, then creates a Lease Awaiting Signature with no Tenant
- Returns a shareable URL: `{origin}/lease/sign/{docId}`
- Idempotency: `useRef` lock prevents double-writes on rapid clicks

### `/lease/sign/[tenantId]`
- On load: `GET /api/signing-links/{id}` returns only `open`, `not_found` or `already_signed`
  - `not_found` → "Link not found" screen
  - `already_signed` → "Already Signed" screen
  - `open` → renders the form, with a download link for `LEASE AGREEMENT updated.01.pdf`
- On submit:
  1. Checks fields and signature in the browser for quick feedback
  2. Exports signature as base64 from canvas
  3. `POST /api/signing-links/{id}/sign`. The server checks everything again, creates the Tenant, links the Lease to them and saves the signature in one transaction, and sends two emails through Gmail (nodemailer): a confirmation with the lease PDF to the Tenant and a notice to the landlord. A failed email does not undo the signing
  4. Redirects to `/lease/success`

### `/lease/success`
- Static confirmation page shown after successful submission

---

## Idempotency

Two layers prevent duplicate Firestore writes:

1. **`useRef` lock** — synchronous JS-level guard that fires before React re-renders:
   ```ts
   const isSubmitting = useRef(false);
   if (isSubmitting.current) return;
   isSubmitting.current = true;
   // ... async write ...
   isSubmitting.current = false; // reset in finally
   ```

2. **`disabled={loading}` on the button** — visual/async layer that disables the button once React processes the state update

The Lease's `signature` also acts as a database-level guard: the server signs a Lease inside a Firestore transaction only if it has none yet, so a second submission gets `already_signed`.

---

## Security

The rules live in `firestore.rules` at the repo root. Deploy them from the Firebase console (Firestore → Rules) or with the Firebase CLI. They deny all access from the browser. The server reaches Firestore with `firebase-admin`, which bypasses the rules, and lets only Google accounts carrying the `landlord` custom claim use the dashboard routes. No email address appears in the rules or the code. To make an account the landlord, list it in `LANDLORD_EMAILS`, have it sign in to the dashboard once, run `npm run grant-landlord`, then sign out and in again.

The server needs these environment variables (in `.env.local` locally):

| Variable | Purpose |
|---|---|
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Service account for `firebase-admin` (Firebase console → Project settings → Service accounts → Generate new private key) |
| `LANDLORD_EMAILS` | Comma-separated Google accounts that `npm run grant-landlord` marks as the landlord |
| `EMAIL_USER`, `EMAIL_PASS` | Gmail address and App Password for sending email |
| `NEXT_PUBLIC_APP_URL` | Public address of the app, used in the landlord's email |

---

## Known Limitations

| Limitation | Notes |
|---|---|
| Firebase credentials exposed | `NEXT_PUBLIC_*` env vars are visible in the browser bundle. This is standard for Firebase Web; the Firestore rules deny all browser access, so the keys reach no data. |
| Landlord claim set by hand | Removing an account from `LANDLORD_EMAILS` does not remove its `landlord` claim; clear it in code with `firebase-admin` if that is ever needed. |
