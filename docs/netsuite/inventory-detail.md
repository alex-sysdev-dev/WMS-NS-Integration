# The Inventory Detail subrecord

This is the mechanism every lot + bin + status write goes through. Source: `fid=section_0326021504`
("Entering Inventory Details on Transactions or Records"), plus per-transaction topics.

## Transactions that carry an Inventory Detail column

With the Advanced Bin feature, the Inventory Detail icon appears on:

Assembly Build · Assembly Unbuild · Bin Transfer · Bin Putaway · Cash Refund · Cash Sale · Check ·
Credit Card Charge · Credit Card Refund · Credit Memo · Inventory Adjustment · Inventory Count ·
Inventory Distribution · Inventory Transfer · Inventory Worksheet · Invoice · Item Receipt ·
Item Fulfillment · Purchase Order · Return Authorization · Sales Order · Transfer Order ·
**Vendor Bill** · Vendor Credit · Vendor Return Authorization · Work Order

**Vendor Bill is on that list.** That is the load-bearing fact for LED Connection's inbound flow, where
lot/bin assignment hangs off Vendor Bills rather than Item Receipts.

Icon states: an **arrow** means detail is available and not yet configured (edit mode only); a
**check mark** means it's configured (shows in view mode, or in edit mode after configuring).

## Popup contents

- **Bin** column defaults to the item's preferred bin. Available bins are filtered by the transaction's
  location.
- Bin filters: All bins · Preferred bin · Associated bin. On transactions that *increase* on-hand,
  two more appear: Bins with quantity · Previously used Bins.
- **Status** field appears when the Inventory Status feature is enabled — for items with and without bins.
- Bin Transfer's popup takes both an originating bin and a receiving bin.
- The total quantity entered across all detail lines must equal the line's Quantity.

## Entering lots, serials, and bins inline (without the popup)

| Thing | Format | Example |
|---|---|---|
| Lot numbers | `LOT#(Quantity)` | `ABC1234(100)` |
| Multiple lots | comma-separated | `Lot101(10), Lot102(20)` |
| Serial numbers | one per unit, separated by space, comma, or Enter | qty 2 → two serials |
| Bins | `Bin#(Quantity)`, comma-separated | `A101(50), A102(43)` |

Total quantity across lot numbers must match the quantity being transacted. With **basic** Bin
Management you may only enter bins already associated with the item on its Bin Numbers subtab.

## Bulk entry helpers

- **Express Entry** — paste a block of numbers into a text box; on OK the detail list is populated.
- **Autogenerate Numbers** — available on transactions that increase inventory (item receipts,
  assembly builds for assembly completions). Fields: `Prefix`, `Minimal Digits`, `Starting Number`,
  `Quantity` (the quantity assigned to each generated number).

**For LED Connection:** the autogenerator builds `prefix + sequence`, which does not express LED's lot
rule (start of the part number + MM/YY). The WMS should compute the lot string itself and pass it, either
inline as `LOT#(Qty)` or through the inventory detail subrecord — not rely on NetSuite's generator.

## Lot/serial rules that bite on specific transactions

- **Transfer Order:** if you enter serial numbers on the order, the Serial/Lot field is *disabled* on the
  fulfillment. If you don't, it's enabled there and required. You cannot enter serials for only some
  lines — all or none (`fid=section_N2310933`).
- **Receiving a transfer order:** the Serial/Lot field is **always disabled** on receipt. Inventory numbers
  and lot quantities on the item receipt must match the item fulfillment. Changes must be made on the
  fulfillment *before* creating the receipt; after receipt, correcting them requires an inventory
  adjustment or deleting the receipt (`fid=section_N2312912`).
- **Entering a specific lot or serial on an order designates that exact stock** and NetSuite attempts to
  allocate it. Leaving it blank allocates quantity only and defers number assignment.
- Partial fulfillment/reallocation with numbered inventory invites quantity mismatches — NetSuite's
  advice is to put lot/serial numbers on the transfer order up front
  (see "Avoiding Quantity Mismatches when Committing Numbered Inventory").
- **Inventory Worksheet excludes lot and serialized items entirely**, active or inactive
  (`fid=section_161981128590`). Lot-tracked stock must be adjusted via Inventory Adjustment.
