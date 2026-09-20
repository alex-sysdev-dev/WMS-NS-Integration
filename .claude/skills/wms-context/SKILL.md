---
name: wms-context
description: Load full background on the WMS_Build project (what it is, why it exists, LED Connection's real NetSuite shape, and hard constraints, including the standing rule that agents never write to NetSuite at all). Use at the start of a session, before delegating to a subagent that won't inherit memory, or any time you need the "why" behind this codebase restated without asking Alex to repeat it.
---

# WMS_Build project context

This is a from-scratch WMS for **LED Connection** (a live-event lighting/rigging fabrication
shop) that integrates with **NetSuite**. Started 2026-08-01 from an existing Next.js dashboard scaffold and
stripping it down. Read this before making architectural suggestions or NetSuite-facing changes.

## What this actually is

Not a classic storage warehouse. It's a **project-based flow-through fulfillment system**:

- Material is purchased *per project*, not stocked speculatively — inventory is committed to a
  job before it even arrives.
- Everything installed at a venue is permanent and never returns: no rentals, no check-in, no
  availability-vs-committed logic, no serialized round-tripping.
- The **job** is the operational hub, not the sales order (`job.custentity3` is a 22-stage
  pipeline from Quote Intake through Closed; only ~15 jobs sit in warehouse-active stages at once).
- **Fabrication is a real, currently-untracked stage** between receiving and shipping (`FAB1`–`FAB9`
  bins, job stage `13 - Fabrication`). Zero Kit items, Work Orders, or Assembly Builds exist in
  NetSuite — this is the biggest greenfield opportunity, not a gap to force NetSuite's kitting
  model into.
- Receiving is a manual **three-way match**: Sales Order vs Purchase Order paperwork vs physical
  goods. On mismatch, staff currently overwrite inventory to match reality — which silently erases
  that a variance ever happened. Recording expected-vs-received as its own variance record (instead
  of overwriting) is an open, valuable design target.
- Inventory is **lot-tracked, never serialized** — every transaction needs item + lot + bin + qty.
  Lots are assigned by LED Connection at receiving (rule: **PO number + MM/YY**, e.g. `PO2903 8/26`),
  not read off a vendor label, so the WMS can generate them. The lot is keyed to the **PO, not the
  item** — every line on one PO shares a lot.

## Terminology

Say **"shipping,"** never "outtake" — despite NetSuite field/search names like
`custentity_ledreadyforouttake` and "Pending Outtakes," nobody at LED Connection uses that word.
It's legacy/finance vocabulary baked into metadata only. Never let it leak into UI copy or docs.

## Architecture decisions already made

- **This is a standalone project with no upstream.** It began from a generic Next.js dashboard
  scaffold, and everything traceable to that origin has been removed: the demo datastore, the
  seeded and simulated data, the sales and investor-facing surfaces, and the fulfillment-center
  metrics that never described this warehouse. What survives is the visual shell only, which is
  the dashboard layout, sidebar, KPI tiles, hand-rolled charts (no chart library), and DataTable.
  Do not reason about "what the original did." It is not a reference for anything.
- **NetSuite holds all data. There is no second datastore, and none is to be added.** Not merely
  system of record for inventory/PO/SO truth: warehouse-floor execution state (variance records,
  fabrication tracking, etc.) lands in NetSuite too, via custom records/fields. Supabase has been
  removed in full, including the clients, queries, migrations, `supabase/` directory, and every
  `@supabase/*` package. Do not reintroduce it, and do not substitute Postgres, SQLite, Prisma,
  or a hosted database while the NetSuite integration is unbuilt. Modules in `lib/queries/`
  return honest empties behind a `*_SOURCE_READY` flag; leave them that way until there is a
  real source.
- **One shared NetSuite identity, not per-user logins.** Warehouse staff will never log into
  NetSuite directly — the WMS uses a single dedicated service account (never Alex's personal
  login) for all reads/writes, keeping NetSuite licensing flat as headcount grows. Because of
  this, **the acting person's identity must be stamped onto every record from day one** via a
  WMS-user → NetSuite-employee mapping — retrofitting this later leaves a blind spot in history.
- **Integration path is the NetSuite REST API** (SuiteQL over REST for reads, record API/RESTlet
  for writes) with machine-to-machine credentials — **never the MCP connector**, which needs
  interactive OAuth and can't run headless in production.
- **Sign-in is Microsoft 365 / Entra ID**, wired with Auth.js and awaiting only the app
  registration (the company already pays for it and IT already handles offboarding there).
  `lib/auth/current-user.ts` is the single seam the app uses to ask who is signed in; nothing
  outside `lib/auth/` imports a provider. Entra covers staff only. Fabrication associates cannot
  use it, because temps get no Microsoft account and the fab laptops are shared, so a session
  login would attribute a week of timer activity to whoever signed in first. Their path is a
  badge scan per action and is not built yet. See `docs/entra-sign-in-setup.md`.
- **Build for scale beyond ~5 desk users** — handheld scanners for floor associates are a planned
  pitch, so avoid a supervisor-only tool that would need a rewrite.

## Hard constraint: agents never write to NetSuite

**No agent writes to NetSuite. Not production, not sandbox.** This is the current standing rule as
of 2026-08-27 and it is stricter than the sandbox-only rule earlier versions of this file described.
Reading production for discovery (real bin names, real item shapes, real job stages) is fine and
encouraged. Every create or update is Alex's, done by hand in the NetSuite UI, until he lifts this.

The NetSuite MCP connector exposes `ns_createRecord` and `ns_updateRecord` and is **not read-only**,
so the rule is enforced mechanically rather than left to judgment: the `PreToolUse` hook in
`WMS_Build/.claude/hooks/guardrails.ps1` blocks every NetSuite write tool by name, with no sandbox
exception. If a task looks like it needs a write, stop, say so, and hand it to Alex. Do not propose
a workaround and do not ask for an exception mid-task.

Sandbox stays the target for the day writes are turned back on. Lifting the rule means editing the
hook deliberately, which is the point.

## Local dev: bypassing the landing page / sign-in

`app/page.tsx` (the `/` route) always renders the public landing page (`LandingHero`) — that's
intentional and not gated by dev access. To see the actual app without signing in:

1. Confirm `.env.local` has `LOCAL_DEV_PLATFORM_ACCESS=true` (hard-gated off in production builds
   via `NODE_ENV`, see `lib/dev-access.ts`).
2. Navigate directly to a protected route — `/dashboard`, `/inbound`, `/outbound`, `/fabrication`,
   `/fab-team`, or `/qc` — instead of `/`. `proxy.ts` skips the identity check entirely for these
   prefixes when the flag is on, and `/login` auto-redirects to `/dashboard`. The bypass user is
   stamped `isLocalDev: true` so it can never be mistaken for a real person on the floor.

## NetSuite platform rules

Distilled Help Center reference lives in [`docs/netsuite/`](../../../docs/netsuite/README.md) — feature
dependency map, the Inventory Detail (lot/bin/status) subrecord, transaction behavior rules, bins and
Inventory Status, the WMS SuiteApp (not licensed here), and dashboards. **Read it before designing a
NetSuite-facing flow**; it answers most "can NetSuite even do this" questions without a Help Center trip.
Two headlines: **Vendor Bill carries the Inventory Detail subrecord** (so lot+bin on a Vendor Bill is
supported, not a hack), and **Inventory Status** is the native way to model fabrication / QA-hold /
variance-pending state now that there's no side database.

## NetSuite data-shape gotchas (verified live 2026-08-01/02, read-only)

- Zero Item Receipts exist account-wide — inbound is received against the **Vendor Bill** instead
  (618 lot/bin `inventoryassignment` rows hang off Vendor Bills). Writing lot+bin onto an AP-owned
  document is the highest-risk integration question in the project.
- The MCP connector's queryable `transaction` table is scoped to only seven types (VendBill,
  Opprtnty, PurchOrd, Estimate, CustInvc, SalesOrd, ItemShip) — every other transaction type
  (`inventoryadjustment`, `itemreceipt`, `workorder`, etc.) errors "Record not found," which looks
  identical to an empty table but isn't. **Never claim a record type has zero records from these
  queries alone** — say "not visible via the connector" and have Alex confirm in the NetSuite UI.
- SuiteQL is Oracle-flavored (no CTEs, `TO_DATE(...)`), and `>`/`<` get HTML-escaped by the MCP
  transport and break the parser — use `BETWEEN` or `!=` instead.

## Where the fuller record lives

This skill is the fast-load summary. For more depth:

- [`README.md`](../../../README.md) — module-by-module status table and the operational narrative
  (why a project-keyed queue, why no returns logic).
- [`docs/netsuite/`](../../../docs/netsuite/README.md) — distilled NetSuite platform reference:
  feature dependencies, the Inventory Detail subrecord, transaction rules, bins and Inventory Status.
- [`docs/led-connection-shared-context.md`](../../../docs/led-connection-shared-context.md) — the
  cross-project layer shared with the Printing, Android Scanning, and Shipping/Tracking projects (NetSuite
  account facts, identity model, terminology, the no-NetSuite-writes rule). Anything true of **every project**
  in the series belongs there, not here.

NetSuite specifics not repeated above (subsidiary list, full bin inventory, saved searches, per-user
licensing math) were established live and read-only on 2026-08-01/02 — re-query them rather than
trusting a remembered number.
