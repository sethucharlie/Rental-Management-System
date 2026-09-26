# Architecture — Lease Management System

This document describes the technical architecture, data model, component structure, and key design decisions behind the system.

---

## Overview

The system is split into two user-facing surfaces:

| Surface | Path | Audience |
|---|---|---|
| Admin Portal | `/login`, `/dashboard/*` | Property manager |
| Tenant Signing Page | `/lease/sign/[tenantId]` | Tenant |

All data is persisted in **Firebase Firestore**. Authentication uses **Firebase Auth** with Google Sign-In. There is no separate backend server. The dashboard reads and writes Firestore from the browser as the signed-in landlord. Everything the Tenant does runs in Next.js Route Handlers, which call the **Lease module** on the server.

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

### Firestore Collection: `tenants`

Each document represents one lease agreement slot.

```typescript
interface Tenant {
  id: string;                  // Firestore auto-generated document ID

  // Set by admin at link creation
  unitType: string;            // e.g. "Flat" | "House"
  unitNumber: string;          // e.g. "5"
  rent: string | number;       // e.g. "3000"
  status: "pending" | "active" | "moved_out" | "archived";
  isSigned: boolean;           // false until tenant submits

  // Set by tenant at signing
  name?: string;               // Full name
  idNumber?: string;           // SA ID number
  phone?: string;              // Phone number
  signatureName?: string;      // Printed name (from signature block)
  signatureDate?: string;      // Date signed (from signature block)
  signatureBase64?: string;    // Full base64 PNG of the drawn signature

  // Timestamps (Firestore serverTimestamp)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
  moveOutDate?: string | null;
}
```

### Key Design Decisions

**Master PDF in Public Folder:**
The lease document (`public/LEASE AGREEMENT updated.01.pdf`) is a static file in `public/`. This avoids Firebase Storage. The signing page offers it for download, and the Tenant's confirmation email attaches it.

**Signature stored as base64 in Firestore:**
The signature is a PNG exported from the canvas as a data URL (base64 string) and saved directly in the Firestore document. Signature images are typically 20–50KB — well within Firestore's 1MB document limit. This completely removes the need for Firebase Storage.

**Signing runs on the server:**
The signing page never touches Firestore. It calls Route Handlers, which call the Lease module (`src/lib/lease/`). The module checks every field again, marks the link signed inside a Firestore transaction (so a link can be signed only once), and sends the emails. Route Handlers use the `firebase-admin` SDK, which bypasses the Firestore rules, so the rules can close all public access.

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
│     Form modal for admin to update unitType, unitNumber, rent, status.
│     Calls updateDoc() directly on Firestore on save.
│     Used by: /dashboard/tenants/page.tsx
│
└── ConfirmDeleteModal.tsx
      Confirmation dialog before permanently deleting a tenant record.
      Calls deleteDoc() on Firestore on confirm.
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
- Real-time tenant list via Firestore `onSnapshot` listener
- Features: search, filter by status/unit, sort by name or date
- Row actions: edit, view signature, archive, delete
- All mutations (edit, archive, delete) write directly to Firestore

### `/dashboard/create-tenant`
- Admin form: Unit Type, Unit Number, Rent
- On submit: `POST /api/signing-links` with the landlord's Firebase ID token. The server checks the token carries the `landlord` claim and the fields are valid, then creates the document with `isSigned: false`
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
  3. `POST /api/signing-links/{id}/sign`. The server checks everything again, saves it with `isSigned: true` and `status: "active"`, and sends two emails through Gmail (nodemailer): a confirmation with the lease PDF to the Tenant and a notice to the landlord. A failed email does not undo the signing
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

The `isSigned` flag also acts as a database-level guard: the server marks a link signed inside a Firestore transaction, so a second submission gets `already_signed`.

---

## Security

The rules live in `firestore.rules` at the repo root. Deploy them from the Firebase console (Firestore → Rules) or with the Firebase CLI. They allow tenant data only to Google accounts carrying the `landlord` custom claim and deny everything else. No email address appears in the rules or the code. To make an account the landlord, list it in `LANDLORD_EMAILS`, have it sign in to the dashboard once, run `npm run grant-landlord`, then sign out and in again. Tenants never reach Firestore directly; the server does it for them with `firebase-admin`.

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
| Firebase credentials exposed | `NEXT_PUBLIC_*` env vars are visible in the browser bundle. This is standard for Firebase Web; the Firestore rules are what protect the data. |
| Landlord claim set by hand | Removing an account from `LANDLORD_EMAILS` does not remove its `landlord` claim; clear it in code with `firebase-admin` if that is ever needed. |
