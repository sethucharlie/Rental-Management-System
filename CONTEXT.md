# Lease Management

A landlord rents out units on one property and has tenants sign lease agreements online.

## Language

### Leases

**Tenant**:
A person who rents a unit on the property. One tenant may sign many Leases over the years. A Tenant is either Current (lives here) or Moved Out.
_Avoid_: Occupant, renter, archived tenant

**Identity Number**:
The number that identifies a Tenant: their South African ID number, or their passport number if they have no South African ID.
_Avoid_: ID (alone), passport ID

**Lease**:
One signed agreement between the landlord and exactly one Tenant for one unit. Every Lease ends on 31 December. A Tenant who moves in before 1 November gets a first Lease ending that 31 December; one who moves in on or after 1 November gets a first Lease ending 31 December of the next year.
A Lease is Awaiting Signature, Signed, or Ended.
_Avoid_: Contract, agreement slot, pending, active

**Lease Year**:
The fixed cycle from 1 January to 31 December that all Leases follow, whenever the Tenant moved in.
_Avoid_: Term, cycle, 12-month period

**Lease Document**:
The written terms a Tenant reads and signs, kept as a PDF. The landlord changes it from time to time, for example to add the parking clause.
_Avoid_: Lease form, template

**Lease Schedule**:
One Lease's own details, filled into the Lease Document: the Tenant's particulars, unit, rent, lease period and whether they hold a Parking Reservation.
_Avoid_: Summary, lease details box

**Lease Document Version**:
One edition of the Lease Document's wording, with the landlord's short note of what it changed. Each Lease records the version it was signed on, and every version is kept.
_Avoid_: Revision, template

**Signed Lease**:
The Lease Document Version with one Lease's Schedule and the Tenant's signature filled in; the Tenant's own copy and the record the landlord points to.
_Avoid_: Signed copy, completed form

**Deposit**:
The sum a Tenant pays once, before their first Lease, equal to the rent at that time. It carries across Renewals unchanged; a later rent increase does not raise it, and the Tenant gets back what they paid.
_Avoid_: Security, bond

**Change Notice**:
The list of what a Renewal changes from the Tenant's current Lease: new rent or unit, and the notes of any newer Lease Document Versions. The Tenant sees it in the Renewal email and before signing, and it is kept with the Signed Lease.
_Avoid_: Diff, changelog, summary of changes

**Short Notice**:
A Tenant moving out with less than 15 days' written notice. They owe the rent the landlord actually loses until the unit is let again, up to one month's rent, taken from their Deposit; the rest of the Deposit goes back with interest.
_Avoid_: Early exit, breach of notice

**Renewal**:
A new Lease signed by an existing Tenant for the next Lease Year, on the current Lease Document, for the unit and rent the landlord sets. The Tenant confirms their details and makes a fresh Car Declaration.
_Avoid_: Extension, re-sign

**Renewal Round**:
The landlord's yearly sending of Renewal Signing Links, each October, for the Lease Year that starts the next January.
_Avoid_: Renewal season, re-leasing

**Month to Month**:
The state of a Tenant whose Lease has ended without a signed Renewal but whom the landlord lets stay. Their old terms continue monthly until they sign a Renewal or leave.
_Avoid_: Expired, lapsed, overdue

**Unit Move**:
A Tenant moving from one flat to another during a Lease, with no new signing and no change in rent. The next Renewal names the new flat. A move into or out of the house is not a Unit Move; it needs a new Lease.
_Avoid_: Transfer, relocation

**Signing Link**:
The private web address a Tenant opens to sign one Lease, whether a first Lease or a Renewal. The landlord creates each one and sends it by hand or by email.
_Avoid_: Renewal link, lease URL

### Parking

**Parking Bay**:
One of the two car spaces on the property, so at most two tenants hold a Parking Reservation at once.
_Avoid_: Parking spot, parking space

**Car Declaration**:
A tenant's signed statement, made on the lease, that they do or do not have a car. It is a request, not a claim to a Parking Bay.
_Avoid_: Parking request, car flag

**Parking Reservation**:
The landlord's grant of a Parking Bay to one tenant, at no charge. The landlord accepts an applicant with a car only when a bay is free, so that tenant gets a reservation from move-in. A tenant who gets a car later gets one only if a bay is free when they tell the landlord; if both are reserved, they must park elsewhere, and there is no waiting list. When a bay frees up, the landlord decides who gets it. Only a tenant with a reservation may park, even if another bay stands empty. A reservation ends when the tenant moves out or no longer has a car. Bays are not numbered; the two holders share them.
_Avoid_: Parking allocation, parking right
