# Lease Document wording

The Word files behind each Lease Document Version (ADR 0002). The PDFs that Tenants download live in `public/lease-documents/`.

| File | What it is |
| --- | --- |
| `version-1-original.docx` | The landlord's file `LEASE AGREEMENT updated.01.docx`, copied unchanged. Version 1. |
| `version-2-draft.docx` | The draft of Version 2, with every change tracked under "Claude (draft)". Not approved yet. |

Never edit or delete a file once its version is in use. Signed Leases point to it.

## What the Version 2 draft changes

Open the draft in Word with "All Markup" on to see each change. It makes the seven changes in issue #4:

1. **Parking (new clause 5.8).** Two free bays, not numbered. The landlord grants a Parking Reservation at their discretion. Only a Tenant who holds one may park, even if a bay is empty. A reservation ends when the Tenant moves out or no longer has a car. Nothing about a waiting list.
2. **Clause 2.1, period and Renewals.** The lease runs from its start date to 31 December, or to 31 December of the next year if it starts on or after 1 November. The landlord may offer a yearly Renewal, which may change rent and terms, with no limit on how many. A lease that ends without a signed Renewal goes on month to month if the landlord lets the Tenant stay. The "12 MONTH LEASE" heading and old clauses 2.1.2 to 2.1.5 are gone.
3. **Short Notice (2.2.2 and 2.2.3).** With less than 15 days' notice, the Tenant owes the rent the landlord actually loses until the unit is let again, up to one month's rent, taken from the Deposit. The rest of the Deposit goes back with interest. "Under no circumstances be limited" is gone.
4. **Clause 3.2.5.** The Deposit comes back within 14 days of the Tenant returning the premises, not of the repairs being done.
5. **Clause 8.8 (joint and several liability)** is removed.
6. **Fill-in fields** in square brackets: `[Tenant name]`, `[Identity Number]`, `[Date of birth]`, `[Phone]`, `[Email]` (new line, and in 8.5.1.2), `[Unit]` (1.1), `[Start date]` and `[End date]` (2.1.1), `[Rent]` (3.1.1), `[Yes / No]` for the Parking Reservation (5.8.5), `[Date signed]`, `[Printed name]` and `[Signature]`. How these become real fields waits on the PDF decision in #3.
7. **Inspection checklist** at the end is left as blank lines.

## Questions for the landlord (and a lawyer)

These are choices the draft made, or things it noticed and left alone:

- **Deposit on a Renewal (3.2.1, unchanged).** It says the Tenant pays R1500 or R3000 "on signature of this agreement". On a Renewal that reads as a second Deposit, which is wrong: the Deposit carries over. Should 3.2.1 say the Deposit paid under an earlier lease carries over, and give the amount as a field?
- **2.1.1 start date.** The old "or upon payment of deposit and rental" is gone. Clauses 3.1.2 and 3.2.1 still bar occupation until both are paid. Is that enough?
- **Car Declaration (5.8.4).** Added so the Tenant's answer is on the signed lease. Issue #4 did not list it.
- **Month to month (2.1.3).** It names no notice period for ending a month-to-month lease. The law may set one; a lawyer should say whether to state it.
- **Cancellation penalty (2.2.1 and 2.2.4, unchanged).** Check they still fit the new Short Notice wording in 2.2.2.
- **One Tenant per lease.** The second Tenant signature row is removed.
- **Checklist reference.** The checklist says it is attached "as intended in paragraph 5.2", but 5.2 is about who may live there. Left as it is.

Once approved, the next step is to turn the approved Word file into the Version 2 PDF and register it in `src/lib/lease/document-versions.ts` with a short change note.
