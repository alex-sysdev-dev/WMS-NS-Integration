# Bins, putaway, and Inventory Status

## Bin records

`Lists > Supply Chain > Bins > New` (`fid=section_N2274082`).

- No limit on the number of bin records.
- **Location cannot be changed after saving** a bin record.
- Naming is free-form; NetSuite's own example is row/shelf by letter, bin by number → `AA01`.
- Basic Bin Management + MLI → **bins must be used in all locations**. Advanced Bin + MLI → bins per
  location.
- **Item costing is not calculated per bin.** Only on-hand and available quantities are tracked per bin.
  Committed, backordered, and on-order are **not** per-bin.

Item setup (`fid=section_N2274433`): check `Use Bins` on the item's Purchasing/Inventory subtab. With
**basic** Bin Management you must associate at least one bin on the Bin Numbers subtab or no bins appear
in transaction lists. With **Advanced Bin**, association is not required to use bins on transactions.
One **preferred bin per location**; the preferred bin defaults on all receiving and fulfilling
transactions and on the putaway worksheet.

Removing bins from an item that still holds quantity in them causes on-hand vs bin quantity
discrepancies — clear quantities first.

**Do not use Location records to represent bins, shelves, or docks.** NetSuite states this causes
problems with fulfillments, LIFO/FIFO costing, and reporting (`fid=section_N2252794`).

## Bin Transfer

`Transactions > Inventory > Bin Transfer` (`fid=section_N2278346`).

- **No GL impact.** Does not post to the chart of accounts; only updates per-bin on-hand.
- **Same location only.** Moving between locations requires an Inventory Transfer with the bin set at
  the destination.
- Only moves stock that is *already in a bin*. Newly received stock gets its first bin via the
  Bin Putaway Worksheet.
- Advanced Bin flow: enter item + quantity, then use the Inventory Detail popup to pick lot/serial,
  From Bin, and To Bin.
- Bulk import available (Bin Transfer Import).

This is the right primitive for FAB1–FAB9 fabrication staging: it records physical movement with no
accounting consequence.

## Putaway

`Transactions > Inventory > Bin Putaway Worksheet` (`fid=section_N2275156`).

- Shows available bins per item including the preferred bin; printable, with a blank column for noting
  off-preferred placements.
- Used both for initial bin assignment of newly received stock and for items that predate `Use Bins`.

**Critical constraint:** items tracked by bin that have been received but **not yet put away cannot be
fulfilled** (`fid=section_N1229129`). Any WMS receiving flow must end in a bin assignment.

## Bins on picking tickets

Bin numbers print automatically on picking tickets for bin-tracked items. The preferred bin lists first;
if the order quantity exceeds the preferred bin's on-hand, another bin with enough stock is listed;
if no single bin can cover it, bins list by on-hand descending. Lines sort by item name unless a custom
picking ticket specifies another sort column (`fid=section_N1229129`).

## Inventory Status

Requires **Advanced Bin / Numbered Inventory Management** (`fid=section_1518031931`).

### Status records

`Lists > Supply Chain > Inventory Statuses > New` (`fid=section_1498074763`).

- Standard **Good** status exists by default, applies to all existing and incoming items at all
  locations until a transaction changes it. Renameable, **not deletable**.
- Custom statuses can be active or inactive. Deletable only if unused on any completed/pending
  transaction, record, or workflow. **If any non-default status exists, the feature can't be disabled.**
- `Make Inventory Available for Commitment` — clear it to exclude that status's on-hand from the
  available count.
- `Make Inventory Available for Allocation` — same idea for Supply Allocation; the field only appears
  when Supply Allocation is enabled.
- Once a status is used on a completed or pending transaction, **neither availability box can be
  changed**. Decide the semantics before first use.
- Statuses states are shown as default / active / inactive in the State column.

### Status change transaction

`Transactions > Inventory > Inventory Status Change` (`fid=section_1515699503`).

- **Non-posting** — moves quantity between statuses with no GL impact.
- Header: Location, `Previous Status`, `Revised Status`, Date, Memo, auto-numbered transaction number
  (auto-numbering cannot be disabled).
- Lines: item, quantity, units; for lot-numbered, serialized, or binned items the Inventory Detail popup
  captures lot/serial + bin + quantity.

### Limits to understand before designing on this

- The setting only prevents **allocation to orders**. It does not physically stop anyone from picking
  the stock — the Help Center says so explicitly. Physical control stays a process/UI problem.
- Does **not** apply to drop shipments or special order purchases: unavailable-status items can still be
  allocated to drop-ship/special-order sales orders and received on the linked PO
  (`fid=section_1517948058`).
- Existing fulfillment records for items with no available quantity can't be assigned a status; you must
  either create an inventory adjustment (which lets you assign the status) then update the fulfillment,
  or remove and re-add the item on the fulfillment.

### Why this matters here

With NetSuite holding all data, Inventory Status is the native place to express warehouse-floor state
that isn't a quantity change: *in fabrication*, *QA hold*, *received with variance, pending review*.
It's non-posting, lot- and bin-aware, and can withhold the quantity from commitment — which is exactly
the behavior "don't let sales promise this yet" needs.

Also available for non-status availability control: location-level `Make Inventory Available` and
`Make Inventory Available in Web Store` checkboxes, for locations that stock but shouldn't promise
(e.g. inspection/repair holding areas) — `fid=section_N2307648`.
