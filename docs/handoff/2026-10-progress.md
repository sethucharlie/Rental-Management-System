# Handoff: progress on Renewals and Lease Document Version 2

Written 1 October 2026. Picks up from `2026-09-renewals-and-lease-v2.md`, which holds the full plan; read that first. This note says what is built, what is next, and what tripped us up.

**Deadline:** the first Renewal Round goes out in October 2026. Renewal Signing Links must reach Tenants by about **3 November**. Today is 1 October, so about five weeks remain.

## Where things stand

The plan lives in GitHub Issues: PRD #1 and its slices #2 to #14. Every change lands on `main` through a PR, and Vercel deploys `main` to the live site.

### Done (5 of 11 slices)

| Issue | What | PR |
| --- | --- | --- |
| #2 | Signing moved to the server; public reads closed | — |
| #5 | Tenant split from Lease, with migration (ADR 0001) | #15 |
| #6 | Every Lease Document Version kept (ADR 0002) | #16 |
| #7 | A first Signing Link sets start date, Deposit and parking | #17 |
| #10 | First-Lease form: SA ID or passport, Car Declaration, Lease Schedule | #18 |

### Open

| Issue | What | Waits on | Who |
| --- | --- | --- | --- |
| #3 | Choose how to produce the Signed Lease PDF | — | landlord |
| #4 | Draft Lease Document Version 2 wording | — | landlord |
| #12 | Renewal: Signing Link, identity check and signing | — | agent |
| #8 | Dashboard: Deposit, Parking Reservations, Move Out | — | agent |
| #9 | Unit Move | — | agent |
| #11 | Signed Lease generation | #3 | agent |
| #13 | Change Notice | #11, #12 | agent |
| #14 | Dashboard: Renewal flags and Lease history | #12 | agent |

## What to do next

1. **#12, the Renewal page.** It is the longest path to the deadline and nothing blocks it now.
2. **#3 and #4 alongside it.** Both need the landlord. #11 cannot start until #3 picks a PDF approach, and #13 needs #11. Renewals should go out on the Version 2 wording, so #4 must be done and checked before the Renewal Round.
3. **#8 and #9** fit in between; neither is on the path to the deadline.

## What #10 added

These are the facts later slices build on.

- **Tenant:** `identityNumberType` is `"sa_id"` or `"passport"`; new `passportCountry` (null for an SA ID). For an SA ID the date of birth comes from the ID; for a passport it comes from the form.
- **Lease:** new `carDeclaration`: `"car"`, `"no_car"`, or null (unsigned, or migrated).
- Records saved before #10 read as SA ID with no country and no Car Declaration, so no migration was needed.
- `findSubmissionError` in `src/lib/lease/validation.ts` is the one set of checks for signing. The signing page and the server both call it. An SA ID must pass the check digit **and** hold a real date of birth.
- `openSigningLink` now returns the `schedule` (unit, rent, dates, Deposit) as well as the document.
- `LeaseStore.signFirstLease` takes `{ carDeclaration, signature }`. A Renewal will need its own store method; this one creates a new Tenant.
- The landlord can edit a passport Tenant's number but not yet their country or date of birth.

## Things that tripped us up

- **Live data.** `.env.local` points at the live Firestore. There is no emulator and no test project. Don't write to live data to try something out.
- **Checking a page in the browser without live data.** Run `npx next dev -p 3123`. Load both pages once with `curl` so they are compiled. In Chrome, open a page that makes no API calls (such as `/lease/success`) and replace `window.fetch` so `/api/` calls get fake answers. Then call `window.next.router.push('/lease/sign/<any-id>')`. If the page is not compiled first, Next reloads it and the fake `fetch` is lost.
- **Stopping the dev server.** Stopping its shell can leave `next` running and broken, holding the port. Kill the node process that owns the port.
- **Permissions.** Auto mode blocks deleting git branches and writing to live Firestore. The user runs those with `!` in the prompt.
- **Vercel CLI** overwrites `.env.local`. Back it up before any `vercel` command.
- **Lint.** `npm run lint` reports two errors that predate this work: `any` in `src/app/lease/sign/[tenantId]/page.tsx` and `src/app/login/page.tsx`.

## Checks

- `npx vitest run`: 81 tests.
- `npx tsc --noEmit`. If it complains about `RouteContext` types, run `next build` once to refresh Next's generated types.
- `npx next build`.
