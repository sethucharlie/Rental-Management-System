# Split Tenant from Lease

The `tenants` collection held one document per signing: one unit, one signature, locked once `isSigned` was true. Yearly Renewals mean one Tenant signs many Leases, so we split the two: a Tenant is the person (Current or Moved Out), and each Lease is one signed agreement for one Lease Year (Awaiting Signature, Signed or Ended). The old single `status` field mixed both ideas and goes, along with the unused `archived` and `eviction_notice` values.

## Considered Options

- **Add a new record per year to `tenants`.** Rejected: the same person would appear once per year, with personal details copied and drifting apart, and no link between their Leases.
- **Keep one record and overwrite it at each Renewal.** Rejected: it destroys the record of what the Tenant signed in earlier years, which is the point of having a lease.

## Consequences

Existing `tenants` documents must be migrated: each becomes one Tenant plus one Signed Lease ending 31 December 2026. Deposit and Parking Reservation belong to the Tenant, not the Lease, because they carry across Renewals.
