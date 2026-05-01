# Architecture — Lease Management System

This document describes the technical architecture, data model, component structure, and key design decisions behind the system.

---

## Overview

The system is split into two user-facing surfaces:

| Surface | Path | Audience |
|---|---|---|
| Admin Portal | `/login`, `/dashboard/*` | Property manager |
| Tenant Signing Page | `/lease/sign/[tenantId]` | Tenant |

All data is persisted in **Firebase Firestore**. Authentication uses **Firebase Auth** with Google Sign-In. There is no separate backend server — all logic runs either in the browser (client components) or in Next.js Route Handlers.

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
  unitNumber: string;          // e.g. "5B"
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
The actual lease document (`lease-agreement.pdf`) is stored statically in the `public/` directory. This avoids the complexity and setup of Firebase Storage. The Next.js server handles delivering this file to the browser, where it is embedded directly in the tenant signing page via an `<iframe>`.

**Signature stored as base64 in Firestore:**
The signature is a PNG exported from the canvas as a data URL (base64 string) and saved directly in the Firestore document. Signature images are typically 20–50KB — well within Firestore's 1MB document limit. This completely removes the need for Firebase Storage.

**Client-side Firestore writes:**
All Firestore reads and writes happen directly from the browser using the Firebase Client SDK. This bypasses the Next.js API routes (which would require the `firebase-admin` SDK for server-side use). The trade-off is that Firestore security rules are the primary protection layer.

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
- On submit: creates a Firestore document with `isSigned: false`
- Returns a shareable URL: `{origin}/lease/sign/{docId}`
- Idempotency: `useRef` lock prevents double-writes on rapid clicks

### `/lease/sign/[tenantId]`
- On load: reads the Firestore document by `tenantId`
  - If doc doesn't exist → "Link not found" screen
  - If `isSigned === true` → "Already Signed" screen
  - Otherwise → renders the full form embedding `/lease-agreement.pdf`
- On submit:
  1. Validates required fields and signature
  2. Exports signature as base64 from canvas
  3. Calls `updateDoc()` with tenant data + `isSigned: true` + `status: "active"`
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

The `isSigned` flag in Firestore also acts as a database-level guard — the tenant page checks this on load and blocks re-submission if already signed.

---

## Security (Recommended Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /tenants/{tenantId} {
      // Anyone can read a specific tenant doc (needed for the sign page)
      allow read: if true;

      // Only create if not signed yet and only with expected fields
      allow create: if request.auth == null
        && request.resource.data.isSigned == false;

      // Tenant can update ONLY their own doc to submit (once)
      allow update: if request.auth == null
        && resource.data.isSigned == false
        && request.resource.data.isSigned == true;

      // Only authenticated admins can do full writes (edit, archive, delete)
      allow write: if request.auth != null;
    }
  }
}
```

---

## Known Limitations

| Limitation | Notes |
|---|---|
| No server-side validation | Tenant form data is written directly from the browser. A malicious user could manipulate fields via DevTools. |
| Firebase credentials exposed | `NEXT_PUBLIC_*` env vars are visible in the browser bundle. This is standard for Firebase Web but Firestore rules must be tight to prevent abuse. |
| No email notifications | Admin must manually check the dashboard for new submissions. |
| Single admin only | There is no role-based access control — any authenticated Google user who knows the URL can access the dashboard. |
