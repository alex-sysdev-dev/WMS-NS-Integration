# WMS-NS-Integration

Warehouse management system for **LED Connection**, integrated with NetSuite.

NetSuite is an ERP, not a WMS. It records purchasing, sales orders, and shipments,
but several things the warehouse actually does have no record type to live in so
we currently live in monday.com, spreadsheets, and free-text note fields. This
project gives that work a home and writes the results back into NetSuite, so
project managers see shipping data where they already look.

## What makes this warehouse unusual

The design follows from how LED Connection actually operates, which is not how a
typical WMS assumes:

- **Material is bought per project, not stocked.** Inventory is
  effectively committed to a job before it arrives.
- **The warehouse is small and material does not sit long.** Throughput and "is
  this project complete?" matter; storage density does not.
- **Everything is installed permanently at the venue and never returns.** No
  rentals, no returns, no availability-vs-committed juggling.
- **The project is the unit of work, not the sales order.** 541 of 547 sales
  orders carry a NetSuite `job`, and shipping readiness is tracked on the project
  record. A queue keyed on sales orders would not match how the floor thinks.
- **Inventory is lot-tracked and never serialized.** Every transaction carries a
  lot, balances live at item + lot + bin, and one bin can hold two lots of the
  same item.
- **Fabrication is real and completely untracked.** There are nine dedicated
  FAB1–FAB9 bins and a "13 - Fabrication" project stage, but zero work orders,
  zero assembly builds, and zero kit items in NetSuite. This WMS owns fabrication
  natively rather than forcing NetSuite BOMs on a team that has never used them.

## Modules

| Route | Purpose | Status |
|---|---|---|
| `/dashboard` | Operational overview | Structure only, not connected |
| `/inbound`, `/inbound/shipments` | Receiving against projects | Structure only, not connected |
| `/fabrication` | Build queue and component staging | Structure only, not connected |
| `/fabrication/floor`, `/fabrication/tact` | Bench console and tact time | Runs real, project lookup not connected |
| `/outbound`, `/outbound/floor` | Pick, pack, ship | Structure only, not connected |
| `/qc/fabrication` | Inspection of finished builds | Structure only, not connected |
| `/qc/warehouse` | Bin/lot inventory health, cycle counts | Structure only, not connected |
| `/fab-team`, `/fab-team/[memberId]` | Fabrication roster, throughput, quality | Roster real, metrics not connected |

Nothing above reads a datastore yet. Each page renders real structure with an
honest empty state and a visible notice.

No sample data is fabricated anywhere. An empty page and a working page must
never look the same, which is also why the project lookup distinguishes "could
not reach NetSuite" from "no such project" rather than collapsing both into a
blank result.

`/associates` was removed. `/fab-team` replaces it, describing the four real
people on the fabrication team rather than placeholder roster rows.

## Stack

TypeScript throughout. Next.js 16 (App Router, React Server Components),
React 19, Tailwind CSS 4. Charts and KPI tiles are hand-rolled, no chart library.
Auth.js v5 for sign-in. Four runtime dependencies in total.

**There is no datastore.** NetSuite is the only one this project will have, and
that integration is not built yet, so query modules return honest empties behind
a `*_SOURCE_READY` flag and carry a note on what their replacement has to do.
Do not introduce a second datastore to fill the gap.

Fabrication runs are the exception: they are real, and live in an interim store
until fabrication is integrated.

## Authentication

Staff sign in with a Microsoft work account through Entra. Auth.js is wired but
**not configured** until an M365 admin creates the app registration; the login
page says so rather than offering a button that fails. Setup is in
[`docs/entra-sign-in-setup.md`](docs/entra-sign-in-setup.md).

Two rules hold this together:

- `lib/auth/current-user.ts` is the only place the app asks who is signed in.
  Nothing outside `lib/auth/` imports a provider.
- Entra covers staff only. Fabrication associates cannot use it, because temps
  do not get Microsoft accounts and the fab laptops are shared, so a session
  login would attribute a week of timer activity to whoever signed in first.
  That surface is authorized by badge scan per action and is not built yet.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Create `.env.local` in the repo root:

- `LOCAL_DEV_PLATFORM_ACCESS=true` — browse protected pages without signing in.
  Hard-gated on `NODE_ENV`, so it cannot be active in a production build. This
  is the only way in until Entra is configured.
- `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`,
  `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, `AUTH_SECRET` — Microsoft sign-in. See
  [`docs/entra-sign-in-setup.md`](docs/entra-sign-in-setup.md).
- `ANTHROPIC_API_KEY` — **server only.** Never prefix a secret with
  `NEXT_PUBLIC_`; Next.js inlines those into the browser bundle.

The local dev user is stamped `isLocalDev: true` and named "Local Dev
(unauthenticated)", so anything recording attributable activity can tell it
apart from a real person on the floor.

### Verification

The npm script wrappers have been unreliable under automation on Windows. Direct
entrypoints are more dependable:

```bash
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/next/dist/bin/next build
node ./node_modules/eslint/bin/eslint.js app components lib types
```

## NetSuite integration notes

**No writes to NetSuite. None.** Not production, not sandbox. Reading production
for discovery is expected and encouraged; every write is out of scope until Alex
explicitly lifts that rule. `ns_runCustomSuiteQL` is `SELECT` only.

The app has no NetSuite connection of its own yet. The MCP connector used for
discovery is a Claude tool, not an app integration, so the Next.js server cannot
query NetSuite until it has token-based auth and a SuiteQL or RESTlet endpoint.
That is a credentials gap, not a guardrail one.

Two facts drive the receiving design:

1. **There are zero Item Receipts in the account.** Inbound material is recorded
   against the **Vendor Bill**, an Accounts Payable document, so NetSuite learns
   what arrived when Accounting processes paperwork rather than when the warehouse
   takes delivery. Whether to introduce real Item Receipts is a business decision
   with AP implications, not just a technical one.
2. **SuiteQL is Oracle-flavored**, not Postgres: `||` for concatenation,
   `TO_DATE(...)` for dates, and no `WITH`/CTE support.
