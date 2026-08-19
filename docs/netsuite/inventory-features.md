# Feature dependency map

What has to be enabled for a capability to exist. Setup > Company > Setup Tasks > Enable Features.

## Baseline inventory setups

| Setup | Company subtab | Transactions subtab | Items & Inventory subtab |
|---|---|---|---|
| Inventory only | — | — | Inventory |
| Inventory with Locations | Locations | — | Inventory |
| Inventory with Multi-Location Inventory | Locations | Sales Order, Advanced Shipping, Advanced Receiving | Inventory, Multi-Location Inventory |

Source: `fid=section_161963741628`.

NetSuite recommends enabling Multi-Location Inventory (MLI) alongside Locations **even for a single
location**, especially in OneWorld accounts.

**MLI is effectively one-way.** Once enabled and inventory distributed, it cannot be disabled from the
UI — only NetSuite Support can turn it off (`fid=section_N2252794`).

After enabling MLI, unallocated inventory sits in a null location and must be moved with an
Inventory Distribution (Simple = everything to one location; Manual = per-location quantities) before
inventory transactions will work. Distributions are permanent and backdated transactions before a
distribution get no location impact (`fid=section_N2304534`, `_N2304987`, `_N2305248`).

## Capability → required feature

| Capability | Requires |
|---|---|
| Stock tracked per location, fulfill/receive per location, transfer between locations | Multi-Location Inventory |
| Bins in a location | Bin Management (basic) or Advanced Bin / Numbered Inventory Management |
| Bins per-location (rather than all locations) | Advanced Bin + MLI |
| Lot or serial numbers **in bins** | Advanced Bin / Numbered Inventory Management |
| Inventory Status | Advanced Bin / Numbered Inventory Management |
| `Make Inventory Available for Allocation` on a status | Supply Allocation |
| Receipt separate from vendor bill, bill-from-receipt, bulk receive, receipt overage | Advanced Receiving |
| Fulfillment separate from invoicing | Advanced Shipping |
| Pick → Pack → Ship as three steps | Pick, Pack, and Ship |
| Transfer orders | Multi-Location Inventory |
| Replenish Location by Transfer Order | Multi-Location Inventory **and** Advanced Inventory Management |
| Reorder point / preferred stock level auto-calculation, lead time, safety stock, seasonal demand | Advanced Inventory Management |
| Cross-subsidiary fulfillment | OneWorld + MLI + Intercompany Cross-Subsidiary Fulfillment + Advanced Shipping (Multiple Shipping Routes to expose the line preferences) |
| Item location attribute management / filtering on item records | Advanced Item Location Configuration (with MLI) |

## Advanced Inventory Management (AIM)

Checking **Advanced Inventory Management** (Items & Inventory subtab) auto-enables:

- Bar Coding and Item Labels
- Lot Tracking
- Matrix Items
- Pick, Pack, and Ship
- Serialized Inventory
- Multiple Units of Measure

It also makes these *accessible but not automatically enabled*: Advanced Bin / Numbered Inventory
Management, Bin Management, Landed Cost (`fid=article_162488513759`).

Side effects worth knowing: AIM auto-calculates reorder points and preferred stock levels on the
**first night** after enabling, regardless of the weekday configured for weekly recalculation. Per-item
AIM can be turned off, reverting to the last manually entered lead time / preferred stock level /
reorder point (`fid=chapter_N2285050`).

Note AIM's calculations consider sales history from before an item was converted to an inventory item
(`fid=section_N2258046`).

## Disabling bins later is painful

Disabling the Use Bins setting does **not** move or clear quantities — stock left in bins becomes
unavailable for fulfillment. Order of operations to unwind: clear bin quantities with inventory
adjustments per location → remove bins from the item's Bin Numbers subtab → clear Use Bins on the item
→ clear Use Bins on the location (only possible when the location has no bins and no bin-referencing
transactions) → only then consider disabling the features. Never toggle Use Bins repeatedly while
transactions are pending (`fid=section_0512092419`).

## Cross-subsidiary fulfillment (OneWorld)

Global Inventory Relationship (GIR) records at Lists > Supply Chain > Global Inventory Relationship
define which subsidiary's locations may fulfill for, or receive returns on behalf of, an originating
subsidiary. Notable behaviors (`fid=section_1515704248`, `_1515704287`, `_1515703010`):

- `Allow Cross-Subsidiary Fulfillment` and `Allow Cross-Subsidiary Customer Return` are **hidden and
  checked by default**; you must customize the transaction form to show them, and Multiple Shipping
  Routes must be checked to check them.
- With the feature on, the line-level `Location` field is replaced by `Inventory Location`; the header
  `Location` becomes accounting-only classification.
- `All Fulfillment Locations` / `All Customer Return Locations` keep the GIR's location list synced to
  the inventory subsidiary automatically.
- A GIR cannot be inactivated or deleted once used on a cross-subsidiary sales order or RMA.
- Role restrictions are relaxed for cross-subsidiary processing (you can fulfill a line for your
  location on an order that originated in a subsidiary you can't otherwise access).
- **Incompatible with the NetSuite WMS Advanced SuiteApp** — errors may occur processing inventory.
