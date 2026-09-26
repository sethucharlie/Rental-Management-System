# Build each Signed Lease from a versioned template

Until now a Tenant signed a web form next to a blank master PDF, and the confirmation email attached that blank PDF, so no document held the Tenant's name, unit, rent and signature together. We now fill each Tenant's details and signature into the Lease Document and produce their own Signed Lease. The rent then lives in one place, the app, and cannot disagree with the PDF. Because the wording changes over time, every Lease Document Version is kept and each Lease records the version it was signed on, so an old Signed Lease always shows the words that Tenant agreed to.

## Considered Options

- **Keep the blank PDF plus a separate on-page summary box.** Rejected: rent would appear in two places (the PDF and the box), and the landlord would have to edit the PDF by hand at every increase and keep the two in step.
- **Fill in the rent only.** Rejected: the other blanks (tenant, unit, dates) matter just as much in a dispute, and the work is of the same kind.

## Consequences

The Word source (kept outside the repo until the build starts) must be turned into a template with placeholders. Old Lease Document Versions must never be edited or deleted.
