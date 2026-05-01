# Lease Management System

A digital lease-signing platform that allows property managers to generate unique signing links for tenants, and tenants to fill in their details and sign leases digitally — all without printing a single page.

---

## Features

### Admin Portal
- 🔐 Google Sign-In authentication
- 🔗 Generate unique, one-time tenant signing links
- 📋 View all tenants in a real-time dashboard
- ✍️ View tenant signatures directly in the browser
- ✏️ Edit tenant details (unit, rent, status)
- 📦 Archive tenants
- 🗑️ Permanently delete tenants (removes Firestore record)
- 🔍 Search and filter tenants by status or unit
- 📱 Fully responsive — works on desktop and mobile

### Tenant Signing Page
- Fills in their own details (Name, ID Number, Phone)
- Reads a summary of lease terms in-browser
- Signs digitally using a canvas-based signature pad
- Confirms agreement via checkbox
- Redirected to a success page on submission
- Protected against double-submission and invalid/expired links

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Google) |
| Signature | `react-signature-canvas` |
| Icons | `lucide-react` |

---

## Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx              # Auth guard + nav shell for all admin pages
│   │   ├── tenants/page.tsx        # Admin dashboard — tenant list
│   │   └── create-tenant/page.tsx  # Admin — generate signing link
│   ├── lease/
│   │   ├── sign/[tenantId]/page.tsx  # Tenant signing page
│   │   └── success/page.tsx          # Post-submission confirmation
│   ├── login/page.tsx              # Admin login (Google)
│   ├── layout.tsx                  # Root layout (AuthProvider)
│   └── api/tenant/
│       ├── link/route.ts           # (legacy) POST — create tenant stub
│       ├── submit/route.ts         # (legacy) POST — submit tenant data
│       ├── create/route.ts         # (legacy) POST — create tenant
│       ├── update/[tenantId]/      # PATCH — update tenant
│       └── delete/[tenantId]/      # DELETE — delete tenant
├── components/
│   ├── SignaturePad.tsx            # Canvas-based signature capture
│   ├── SignatureViewModal.tsx      # Modal to view tenant signature
│   ├── EditTenantModal.tsx         # Admin edit tenant modal
│   ├── ConfirmDeleteModal.tsx      # Confirm before delete
│   └── index.ts                   # Component barrel exports
├── lib/
│   ├── firebase.ts                # Firebase app init (auth, db, storage)
│   └── auth-context.tsx           # React context for Firebase auth state
└── types/
    └── index.ts                   # Tenant TypeScript interface
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with:
  - **Firestore** enabled (test mode or with rules configured)
  - **Authentication** enabled with **Google** provider

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/lease-management-system.git
cd lease-management-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> ⚠️ **Never commit `.env.local` to version control.** It is already listed in `.gitignore`.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage Flow

### Admin
1. Navigate to `/login` and sign in with your Google account
2. Go to **New Tenant** → fill in Unit Type, Unit Number, and Rent
3. Click **Generate Link** — a unique URL is created and shown
4. Copy and send the link to the tenant (WhatsApp, email, etc.)

### Tenant
1. Opens the link in any browser
2. Fills in their Full Name, ID Number, and Phone Number
3. Reads the lease terms displayed on screen
4. Draws their signature on the canvas
5. Enters their printed name and date
6. Ticks the agreement checkbox
7. Clicks **Submit Signature** → redirected to success page

### Admin (after tenant signs)
- Dashboard updates in real-time
- Tenant row shows ✅ Signed status and **ACTIVE** badge
- Click the green checkmark to view the tenant's signature

---

## Firebase Security Rules

### Firestore (Development)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **For production**, restrict these rules so only authenticated users can write, and tenants can only update their specific document.

---

## Environment

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket (not currently used) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |

---

## Roadmap

- [ ] Tighten Firestore security rules for production
- [ ] PDF generation for lease documents
- [ ] Email notifications to admin on tenant submission
- [ ] Eviction notice workflow
- [ ] Multi-property / multi-admin support

---

## License

Private — All rights reserved.
