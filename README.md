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
| `/dashboard` | Operational overview | Supabase-backed (legacy) |
| `/inbound`, `/inbound/shipments` | Receiving against projects | Supabase-backed (legacy) |
| `/fabrication` | Build queue and component staging | Structure only — not connected |
| `/outbound`, `/outbound/floor` | Pick, pack, ship | Supabase-backed (legacy) |
| `/qc/fabrication` | Inspection of finished builds | Structure only — not connected |
| `/qc/warehouse` | Bin/lot inventory health, cycle counts | Structure only — not connected |
| `/associates` | Roster (placeholder data) | Supabase-backed (legacy) |

Pages marked *not connected* render real structure with honest empty states and a
visible notice. No sample data is fabricated anywhere — an empty page and a
working page must never look the same.

## Stack

TypeScript throughout. Next.js 16 (App Router, React Server Components),
React 19, Tailwind CSS 4. Charts and KPI tiles are hand-rolled — no chart library.
Supabase (hosted Postgres) is the current backend; NetSuite integration is not yet
built.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill it in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser client
- `SUPABASE_SERVICE_ROLE_KEY` — **server only.** Never prefix this with
  `NEXT_PUBLIC_`; Next.js inlines those into the browser bundle, and this key
  bypasses row-level security entirely.
- `LOCAL_DEV_PLATFORM_ACCESS=true` — browse protected pages without signing in.
  Ignored in production.

If the database is unreachable, pages render empty with a single console warning
rather than crashing.

### Verification

The npm script wrappers have been unreliable under automation on Windows. Direct
entrypoints are more dependable:

```bash
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/next/dist/bin/next build
node ./node_modules/eslint/bin/eslint.js app components lib types
```

## NetSuite integration notes

Read-only access first. **Never write to a live NetSuite record** — writes must be
proven against a sandbox account.

Two facts drive the receiving design:

1. **There are zero Item Receipts in the account.** Inbound material is recorded
   against the **Vendor Bill**, an Accounts Payable document, so NetSuite learns
   what arrived when Accounting processes paperwork rather than when the warehouse
   takes delivery. Whether to introduce real Item Receipts is a business decision
   with AP implications, not just a technical one.
2. **SuiteQL is Oracle-flavored**, not Postgres: `||` for concatenation,
   `TO_DATE(...)` for dates, and no `WITH`/CTE support.
