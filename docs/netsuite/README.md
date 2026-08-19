# NetSuite Help Center reference (distilled)

Distilled from ~120 NetSuite Help Center topics Alex pulled on 2026-08-12 → 08-14 covering
inventory management, bins, inventory status, transfers, receiving, fulfillment,
cross-subsidiary fulfillment, the NetSuite WMS SuiteApp, and dashboards.

These notes exist so we don't re-read the Help Center. They record **rules and constraints**,
not click paths. Help Center URLs follow one pattern — swap the `fid`:

```text
https://6355110.app.netsuite.com/app/help/helpcenter.nl?fid=<fid>
```

Each section below names the `fid` for the source topic when a detail is worth re-verifying.

## Files

- [inventory-features.md](inventory-features.md) — which features gate which capabilities, and what enabling one turns on
- [inventory-detail.md](inventory-detail.md) — the lot/bin/status subrecord: which transactions carry it, entry formats, autogeneration
- [transactions.md](transactions.md) — receiving, transfers, adjustments, counts, fulfillment: the behavioral rules
- [bins-and-status.md](bins-and-status.md) — bin records, putaway, and Inventory Status as a state machine
- [wms-suiteapp.md](wms-suiteapp.md) — NetSuite's own WMS SuiteApp (not licensed here) as a spec reference for our handheld flows
- [dashboards.md](dashboards.md) — portlets, Dashboard Tiles, Navigation Portlet, and their limits (low relevance; our UI is Next.js)

## What this changes for WMS_Build

Ranked by how much it moves the project. Items marked **VERIFY** depend on which features are
actually enabled in LED Connection's account — confirm before designing on them.

1. **Vendor Bill carries the Inventory Detail subrecord.** The Help Center lists Vendor Bill among
   the transactions with an Inventory Detail column for lot/serial/bin/status entry
   (`fid=section_0326021504`). Receiving lot+bin against a Vendor Bill — the shape we found live in
   LED's account, and previously flagged as the highest-risk integration question — is a supported
   NetSuite pattern, not a workaround. It does **not** make the Vendor Bill a receiving transaction
   in the workflow sense (no Pending Receipt state, no putaway hook), so the risk moves from
   "is this even possible" to "what do we lose by not having an Item Receipt."

2. **Inventory Status is the native way to model floor state** now that NetSuite holds all data and
   there's no side database. It is non-posting, lot/bin aware, and can exclude a quantity from
   commitment and from Supply Allocation. Fabrication-in-progress, QA hold, and received-with-variance
   are all expressible as statuses instead of custom records. **VERIFY:** requires the Advanced Bin /
   Numbered Inventory Management feature.

3. **Bin Transfer has zero GL impact and is same-location only.** Moving material into `FAB1`–`FAB9`
   is a Bin Transfer, not an Inventory Transfer — no accounting consequence, which is exactly right
   for fabrication staging.

4. **Lot-tracked items are excluded from the Inventory Worksheet.** Lot and serial items never appear
   in the Adjust Inventory Worksheet list, active or not. Since LED's inventory is entirely
   lot-tracked, all quantity corrections must go through Inventory Adjustment (which also preserves
   LIFO/FIFO costing; the worksheet averages it away).

5. **Received-but-not-put-away stock cannot be fulfilled.** If bins are on, putaway is a mandatory
   step in the floor flow, not an optional nicety. Our receiving UI has to end in a bin assignment
   or the goods are stranded.

6. **Committed, backordered, and on-order quantities are not tracked per bin** — only on-hand and
   available are. Any bin-level "what's promised out of this bin" view is something the WMS computes,
   not something NetSuite can answer.

7. **Never model bins, shelves, or docks as Locations.** The Help Center explicitly warns this breaks
   fulfillment, LIFO/FIFO costing, and reporting.

8. **LED does not have the NetSuite WMS Advanced SuiteApp.** Every WMS SuiteApp topic carries
   "This feature is not currently available in your account." That confirms the premise of this
   project, and makes those docs a free functional spec for our own scanner flows. One forward-looking
   trap: Intercompany Cross-Subsidiary Fulfillment is documented as **incompatible** with WMS Advanced,
   so enabling one forecloses the other.
