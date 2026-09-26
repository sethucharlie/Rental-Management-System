# Handoff: yearly Renewals and Lease Document Version 2

Written 26 September 2026, at the end of a design session with the landlord. Nothing has been built yet. The landlord has agreed to everything below.

**Deadline:** the landlord sends the first Renewal Round in **October 2026**, for leases running 1 January to 31 December 2027. Renewal links must go out between about **7 September and 3 November** (the Consumer Protection Act notice window for a 31 December end).

## Read first

1. `CONTEXT.md`: the glossary. Use its words in code, UI text and commits.
2. `docs/adr/0001-split-tenant-from-lease.md` and `docs/adr/0002-signed-lease-from-versioned-template.md`.
3. `docs/research/sa-lease-law.md`: the legal research (Rental Housing Act, Consumer Protection Act, Eastern Cape). Research, not legal advice.
4. `docs/ARCHITECTURE.md`: how the app works today. Two parts of it are stale: the PDF is `public/LEASE AGREEMENT updated.01.pdf`, not `lease-agreement.pdf`, and the email goes out through Gmail with nodemailer, not Resend.

## Facts about the property

- Eastern Cape. No provincial rental rules were found, so the national Acts decide. Assume the Consumer Protection Act applies.
- Flats all rent at one price; the house costs more. Current rent R1500 (flats) and R3000 (house).
- Two parking bays, free, not numbered.
- One Tenant per Lease.

## Part 1: Lease Document Version 2 (the wording)

Source: the landlord's Word file at `C:\Users\User\OneDrive\Documents\Lease Agreement\LEASE AGREEMENT updated.01.docx` (the whole 14-page lease; blanks are plain underscores, not Word fields). Copy it into the repo when building so every version is kept.

Draft these changes, then have the landlord (ideally a lawyer) check them before use:

1. **Add a parking clause.** Two bays, free of charge, not numbered. Only a Tenant holding a Parking Reservation may park, even if a bay is empty. Bays are granted at the landlord's discretion. A reservation ends when the Tenant moves out or no longer has a car. Do not mention a waiting list; there is none.
2. **Rewrite clause 2.1.** The lease runs from its start date to 31 December; a first lease starting on or after 1 November runs to 31 December of the next year. Each year the landlord may offer a Renewal, which may change rent and terms. No limit on Renewals. If a lease ends without a signed Renewal and the landlord lets the Tenant stay, it continues month to month. Remove: the "12 MONTH LEASE" heading, the Tenant's option to renew (2.1.2), "same terms" (2.1.3), the deposit top-up (2.1.4) and the one-renewal limit (2.1.5).
3. **Clauses 2.2.2 and 2.2.3 (Short Notice).** With under 15 days' written notice, the Tenant owes the rent the landlord actually loses until the unit is let again, up to one month's rent, taken from the Deposit; the rest goes back with interest. Remove "under no circumstances be limited".
4. **Clause 3.2.5.** Change "within fourteen (14) days of the repairs been attended to" to "within fourteen (14) days of the Tenant returning the premises to the Landlord" (Rental Housing Act s5(3)(g)).
5. **Clause 8.8 (joint and several liability).** Remove.
6. **Fill-in fields** for: Tenant name, Identity Number (ID or passport), date of birth, phone, email, unit (1.1), start and end dates (2.1.1), rent (3.1.1), Parking Reservation yes/no, signature, printed name and date signed. The rent comes from the app.
7. Leave the inspection checklist at the end as blank lines, filled in by hand.

## Part 2: App changes

### Data

- **Split Tenant from Lease** (ADR 0001). A Tenant is Current or Moved Out; a Lease is Awaiting Signature, Signed or Ended. Drop `archived` and `eviction_notice`.
- **On the Tenant:** personal details, Identity Number type and value, date of birth, Deposit paid (amount), Parking Reservation (yes/no).
- **On the Lease:** unit, rent, start and end date, Lease Document Version, Car Declaration, signature, Change Notice shown (for Renewals).
- **Lease Document Versions:** each has its file and the landlord's short note of what changed. Never edit or delete an old one.
- **Migration:** each existing `tenants` document becomes one Tenant plus one Signed Lease ending 31 December 2026. The landlord then enters Deposit paid and parking for each on the dashboard.

### Signing a first Lease

- The landlord enters unit, rent, start date, Deposit and Parking Reservation when creating the Signing Link. The end date follows the 1 November rule.
- The form asks "South African ID or passport?". SA ID: 13 digits with the existing check-digit test; date of birth comes from the ID. Passport: number (not empty) plus issuing country and date of birth.
- The Tenant makes a Car Declaration.

### Signed Lease (ADR 0002)

- Fill the Tenant's details and signature into the Lease Document Version and give each Tenant their own Signed Lease: emailed after signing (replacing today's blank attachment) and downloadable from the dashboard.
- **Not decided:** how to produce the PDF (for example, a Word template turned into a PDF with form fields and filled with `pdf-lib`, or rendering the lease as HTML). Don't store PDFs in Firestore; a document's limit is 1MB. Either rebuild on demand from the Lease data and its version, or use Firebase Storage (the app avoided Storage so far, so say why if you add it).

### Renewals

- A "Create renewal link" button on each Current Tenant's row. The landlord sets unit and rent, pre-filled from the current Lease. Copy or email the link. Warn if created outside 7 September to 3 November.
- The renewal page first asks for the Tenant's **full** Identity Number (ID or passport, whichever is on record). Only a match opens the page. Limit wrong attempts. Check on the server.
- It shows the **Change Notice**: rent or unit changes (worked out by the app) and the notes of any newer Lease Document Versions. The same Change Notice goes in the renewal email and is saved with the Signed Lease.
- Details pre-filled for the Tenant to check. A fresh Car Declaration; answering "no car" ends a Parking Reservation.
- The link keeps working after 31 December. There is no reply deadline.

### Dashboard

- Show Tenant and Lease state. The app works out two flags: *Renewal sent, not signed* and *Month to Month* (Lease ended, no signed Renewal, still Current).
- Parking: how many of the 2 bays are reserved, and by whom.
- Moving a Tenant out ends their Parking Reservation.
- **Unit Move:** the landlord edits the unit; no signing, no rent change. Moves into or out of the house need a new first Lease instead.

### Security

- Firestore rules let anyone read any tenant document (`allow read: if true`). Pre-filled Renewals make this worse. Move signing-page reads and writes to the server (Route Handlers with `firebase-admin`) and close public reads.

### Docs

- Fix the stale PDF name and email provider in `docs/ARCHITECTURE.md`, and the "Resend" comment in `src/app/lease/sign/[tenantId]/page.tsx`.

## Suggested order

The October deadline drives this. Renewals can't go out until the new wording, the data split and the renewal page exist.

1. Draft the Version 2 wording and send it to the landlord for checking. It runs in parallel with the rest.
2. Data split and migration.
3. Server-side reads and writes; close public reads.
4. First-Lease form: passport option, date of birth, Car Declaration, new landlord fields.
5. Signed Lease generation.
6. Renewal link, identity check, Change Notice, email.
7. Dashboard states, flags, parking view, deposit and parking entry.
8. Docs fixes.

## Out of scope for now

Written rent receipts (the Act expects one for every payment, even EFT), the inspection checklist in the app, deposit refund tracking, and a parking waiting list (decided against).

## Open items for the landlord

- Have the Version 2 wording checked, ideally by a lawyer.
- Optionally confirm with the Eastern Cape Rental Housing Tribunal (086 000 0039, info@ecdhs.gov.za) that no provincial rules apply.
