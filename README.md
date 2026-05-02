# Lease Management System

A digital lease-signing platform that allows property managers to generate unique signing links for tenants, and tenants to fill in their details and sign leases digitally — all without printing a single page.

---

## Features

### Admin Portal
- Google Sign-In authentication
- Generate unique, one-time tenant signing links
- View all tenants in a real-time dashboard
- View tenant signatures directly in the browser
- Receive automated email notifications when a lease is signed
- Edit tenant details (unit, rent, status)
- Archive tenants
- Permanently delete tenants (removes Firestore record)
- Search and filter tenants by status or unit
- Fully responsive — works on desktop and mobile

### Tenant Signing Page
- Fills in their own details (Name, ID Number, Phone, Email)
- 📄 **Downloads your actual PDF Lease Agreement directly from the page**
- Signs digitally using a canvas-based signature pad
- Confirms agreement via checkbox
- Redirected to a success page on submission
- Receives an automated, professional email receipt with the lease attached
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
| Emails | Nodemailer (Gmail SMTP) |
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
│   │   ├── sign/[tenantId]/page.tsx  # Tenant signing page (Embeds PDF & captures signature)
│   │   └── success/page.tsx          # Post-submission confirmation
│   ├── login/page.tsx              # Admin login (Google)
│   ├── layout.tsx                  # Root layout (AuthProvider)
│   └── api/
│       └── email/
│           └── route.ts            # POST — sends automated 
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
public/
└── LEASE AGREEMENT updated.01.pdf # The master PDF lease agreement served to tenants
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with:
  - **Firestore** enabled (test mode or with rules configured)
  - **Authentication** enabled with **Google** provider

### 1. Upload your Lease Agreement PDF
Drag and drop your lease agreement PDF into the `public/` folder and name it exactly `LEASE AGREEMENT updated.01.pdf`. This is the file that will be shown to tenants.

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_16_character_app_password
```

> ⚠️ **Never commit `.env.local` to version control.** It is already listed in `.gitignore`.

### 3. Run the development server

```bash
npm install
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
2. Fills in their Full Name, Email, ID Number, and Phone Number
3. **Downloads the `LEASE AGREEMENT updated.01.pdf` from the screen**
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

### Recommended Production Rules
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

## License

Private — All rights reserved.
