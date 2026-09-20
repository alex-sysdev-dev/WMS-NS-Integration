---
name: led-connection
description: Cross-project context for LED Connection's warehouse software series (the company, the NetSuite account, vocabulary, identity model) and the standing rule that agents never write to NetSuite at all, production or sandbox. Load at the start of any session touching WMS_Build, the Printing project, the Android Scanning app, or the Shipping/Tracking project.
---

# LED Connection — shared context

**Canonical copy:** `WMS_Build/docs/led-connection-shared-context.md`. Copy this file verbatim to
`.claude/skills/led-connection/SKILL.md` in each sibling repo — the YAML frontmatter above makes it
a loadable skill as-is. Edit the canonical copy first, then re-copy. Never fork it per project.

Everything below is true of **every project in the series**. Project-specific facts belong in that
project's own `*-context` skill, not here.

---

## The company and the operation

LED Connection is a live-event lighting/rigging **fabrication shop**, not a distributor. The
warehouse is a **project-based flow-through fulfillment system**, and almost every default a WMS,
label system, or shipping tool assumes is wrong here:

- **Material is bought per project, not stocked.** Inventory is committed to a job before it
  arrives. No speculative stock, no reorder points, no availability-vs-committed math.
- **The job (project) is the unit of work — not the sales order.** 541 of 547 sales orders carry a
  NetSuite `job`. Any queue, label, or tracking view keyed on sales orders will not match how the
  floor thinks. Key on the project.
- **Everything installed at a venue is permanent and never returns.** No rentals, no check-in, no
  returns, no round-tripping, no reverse logistics.
- **Material does not sit long.** Throughput and "is this project complete?" are the metrics.
  Storage density is not.
- **Inventory is lot-tracked and never serialized.** Every inventory transaction needs
  **item + lot + bin + qty**. One bin can hold two lots of the same item.
- **Lots are assigned by LED Connection at receiving**, not read off a vendor label. The rule is
  **PO number + MM/YY** — for example `PO2903 8/26`. The software generates the lot; nobody should
  be typing it. Note what this implies: **the lot is keyed to the purchase order, not to the item.**
  Every line received against one PO shares a single lot, and the same PO received across two
  different months yields two lots. Any UI, label, or query that assumes one lot means one item is
  wrong.
- **Fabrication is a real stage and is completely untracked today.** Nine dedicated `FAB1`–`FAB9`
  bins and a `13 - Fabrication` job stage exist, but there are zero Work Orders, Assembly Builds,
  or Kit items in NetSuite. This is greenfield, not a gap to be filled by forcing NetSuite's
  kitting model onto a team that has never used it.
- **Scale target is beyond the ~5 desk users of today.** Handheld Android scanners for floor
  associates are a committed part of this series (see the project table below). Never design a
  supervisor-only tool that would need a rewrite to reach the floor.

## Vocabulary — use the floor's words

- Say **"shipping."** Never **"outtake."** NetSuite metadata is littered with it
  (`custentity_ledreadyforouttake`, the "Pending Outtakes" saved search) but nobody at LED
  Connection says it. It is legacy finance vocabulary baked into field names only. Never let it
  reach UI copy, labels, docs, or commit messages.
- **Job / project** are interchangeable and mean the NetSuite `job` record. **Not** the sales order.
- **Lot** is our own identifier assigned at receiving. **Bin** is a physical location.

## NetSuite is the system of record — there is no second database

Not just for inventory/PO/SO truth: **warehouse-floor execution state lands in NetSuite too**
(variance records, fabrication tracking, print/scan events, shipment tracking), via custom records
and custom fields. Do not stand up a side datastore to make something easier. If a piece of state
has nowhere to live in NetSuite, the answer is a custom record — or an explicit, argued exception.

**Integration path:** the **NetSuite REST API** — SuiteQL over REST for reads, the record API or a
RESTlet for writes — with **machine-to-machine credentials**. Never the MCP connector in production:
it requires interactive OAuth and cannot run headless.

### Verified data-shape gotchas (established live, read-only, 2026-08-01/02)

- **Zero Item Receipts exist account-wide.** Inbound is received against the **Vendor Bill** — 618
  lot/bin `inventoryassignment` rows hang off Vendor Bills. NetSuite does support the Inventory
  Detail subrecord on a Vendor Bill, so lot+bin there is supported behavior rather than a hack, but
  writing to an AP-owned document is the highest-risk integration question in the series.
- **Receiving is a manual three-way match** — Sales Order vs Purchase Order paperwork vs physical
  goods. On mismatch, staff overwrite inventory to match reality, which silently erases that a
  variance ever happened. Capturing expected-vs-received as its own record is an open design target
  across projects.
- **The MCP connector's `transaction` table only exposes seven types** (VendBill, Opprtnty,
  PurchOrd, Estimate, CustInvc, SalesOrd, ItemShip). Every other type — `itemreceipt`,
  `inventoryadjustment`, `workorder` — errors "Record not found," which is indistinguishable from an
  empty table but is not the same thing. **Never claim a record type has zero records based on these
  queries alone.** Say "not visible via the connector" and have Alex confirm in the NetSuite UI.
- **SuiteQL is Oracle-flavored:** no CTEs, use `TO_DATE(...)`. The MCP transport HTML-escapes the
  greater-than and less-than operators and breaks the parser — use `BETWEEN` or `!=` instead.
- Any specific number here (bin lists, subsidiaries, saved searches, counts) was true in early
  August 2026. **Re-query rather than trusting a remembered figure.**

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

## Identity and auth

- **One shared NetSuite service account for all software** — never Alex's personal login, never
  per-user NetSuite logins. Warehouse staff will never log into NetSuite directly. This keeps
  NetSuite licensing flat as headcount grows.
- **Because the NetSuite identity is shared, the acting person must be stamped onto every record
  from day one**, via a mapping from app user to NetSuite employee. Retrofitting this later leaves a
  permanent blind spot in history. It applies to print jobs, scan events, and shipments exactly as
  it applies to receipts.
- **Sign-in is Microsoft 365 / Entra ID.** The company already pays for it and IT already handles
  offboarding there. Do not build a bespoke auth system.

## The project series

| Project | Repo | Platform | Owns |
|---|---|---|---|
| **WMS** | `WMS_Build` | Next.js web, desk + large screens | Receiving, fabrication, pick/pack/ship floor execution, project-keyed queues |
| **Printing** | _(tbd)_ | Desktop / server-side | Label generation, barcode + lot encoding, print event capture |
| **Scanning** | `C:/Users/AlexAguilar/Led connection scan mod` | **Android, separate app — generic devices now, rugged handhelds later** | Barcode capture on the floor, scan event capture |
| **Shipping & Tracking** | _(tbd)_ | _(tbd)_ | Carrier rating, label purchase, tracking ingest, write-back to the project record |

**Scanning is its own project because it runs on an Android handheld, not a browser on a desk.**
That is a platform split, not a packaging preference — it means a different runtime, offline and
flaky-Wi-Fi behavior on the floor, a hardware trigger instead of a mouse, and a UI designed for
gloves and one hand. Do not assume the WMS web UI can simply be made responsive to cover it, and do
not assume the scanner app can call the same code paths the web app does. It talks to the same
NetSuite data through the same contracts, but it is a separate client.

### Scanner hardware: generic first, rugged later — design for the swap

The floor starts on **generic Android devices** (camera-based scanning) and is expected to move to
**rugged handhelds** — Zebra, Honeywell, or similar — as the operation scales. Nothing in the
codebase may assume which one it is running on.

- **Abstract the scan source behind one interface** from the first commit. Every capture path emits
  the same event — raw barcode string, symbology, timestamp, device id, acting user — and the app
  never branches on hardware anywhere above that boundary. The three implementations to expect are
  **camera** (generic phone/tablet), **keyboard wedge** (rugged device configured to type
  keystrokes — the universal fallback), and **native intent/SDK** (Zebra DataWedge broadcast
  intents and vendor equivalents — more reliable, more device-specific).
- **Always record the symbology and the device**, not just the decoded string. Without it there is
  no way to diagnose a device-class-specific misread later, and no way to prove which hardware a
  bad scan came from.
- **Buy 2D imagers, not laser-only SKUs.** A camera can read 1D and 2D; a laser scanner reads 1D
  only. Standardizing on a 2D symbology and then landing on a laser handheld would strand the fleet.
  This is a procurement constraint as much as a software one.
- **Symbology choice is a joint Printing + Scanning decision and is still open.** The payload is a
  multi-field tuple (item + lot + bin + qty), which argues for a 2D code carrying structured data
  rather than a concatenated 1D string. Whatever is chosen, the Printing project encodes it and the
  Scanning project decodes it — neither may pick unilaterally. Record the decision here when made.
- **Device management scales through Intune**, which the company already has via Microsoft 365 —
  the same place Entra ID sign-in and offboarding already live. Do not introduce a separate MDM.

### Offline is the normal case, not the error case

Wi-Fi on a warehouse floor drops. A scan that cannot reach NetSuite must be **queued locally and
replayed**, never silently dropped and never blocking the associate. This means every scan-driven
write needs an **idempotency key** so a replayed queue cannot double-post, and the acting-user stamp
must be captured at scan time rather than at sync time — otherwise a queue flushed by whoever is
holding the device next attributes the work to the wrong person.

Shared surfaces to keep consistent across every client: the **item + lot + bin + qty** tuple, the
**project as the join key**, the **acting-user stamp**, and the **NetSuite REST credential**. When
two projects have to agree on something, it belongs in this file.

## Keeping this file honest

When a fact here changes, update the canonical copy in `WMS_Build/docs/` and re-copy to the sibling
repos in the same sitting. A stale copy in one repo is worse than no copy, because it reads as
verified truth.
