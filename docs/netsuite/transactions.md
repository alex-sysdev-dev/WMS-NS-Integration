# Transaction behavior rules

Receiving, transfers, adjustments, counts, and fulfillment — the rules that constrain integration
design, not the click paths.

## Receiving

### With vs without Advanced Receiving

Without it, receiving and billing are one transaction. With it (`fid=section_N2412119`):

- Receipt and bill are separate; a PO goes to **Pending Billing** when fully received.
- Bill can be created directly from an item receipt; quantity differences are deducted from the PO
  (`fid=article_162020541497`).
- **Bulk receive** (`Receiving > Receive Orders`, Mark All) requires Advanced Receiving **and**
  Drop Shipments & Special Orders **disabled** (`fid=section_N2414814`).
- **Overage** — `Setup > Accounting Preferences > Order Management > Allow Overage on Item Receipts`
  lets you receive more than the remaining quantity.
- Received PO items can be matched to the vendor bill to check quantity/rate variances
  (Posting Vendor Bill Variances).

Partial receipt → PO status **Partially Received**, inventory updated for what arrived; repeat to receive
the rest. Full receipt → **Pending Billing**. `Related Records > Receipts & Bills` on the PO shows what has
been received and billed.

### Exchange rate on receipts

`Setup > Accounting Preferences > Order Management > Default Receiving Exchange Rate`:
`Use Purchase Order Exchange Rate` or `Use Exchange Rate at the Time of the Receipt`. Overridable per
transaction (`fid=section_N2415572`).

### Deleting a receipt

Deleting an item receipt returns the linked PO to **Pending Receipt**. Requires the Item Receipt
permission at Edit or Full (`fid=article_163705803638`).

### Closing PO lines

To close a PO line manually you must **bill the PO first**. Once all lines are received or closed, the PO
leaves the billing and receiving queues. Closing a line (rather than editing the quantity) preserves the
record of what was originally ordered — the same argument that applies to receiving variances generally
(`fid=section_N2415338`).

### Labels

`Print > Print Labels` from a PO or item receipt produces a label per item in the shipment
(`fid=article_162626600304`).

## Transfers

Three mechanisms (`fid=section_N2308202`):

| Mechanism | Steps | In-transit tracking | GL |
|---|---|---|---|
| Basic Inventory Transfer | one step, both locations update on save | no | moves value between locations |
| Transfer Order | order → (approve) → fulfill → receive | yes | asset → Inventory In Transit → asset |
| Intercompany Transfer Order | same, across subsidiaries (OneWorld) | yes | intercompany AP/AR |

### Basic Inventory Transfer

`Transactions > Inventory > Transfer Inventory` (`fid=section_4660882963`). Up to 1000 item lines. Has
From Bins / To Bins with the preferred bin defaulted. Do not delete or change inventory transactions
dated before an inventory distribution. For large line counts set the `Display Current Count on Transfers`
preference to skip per-line computations.

### Transfer Order statuses

`Pending Approval` → `Pending Fulfillment` → `Pending Receipt` (in transit) → `Received`; or `Rejected`
(`fid=section_N2312176`).

- On **approval**, stock is committed out of the source location and On Order rises at the destination.
- On **fulfillment**, source On Hand drops and value moves to Inventory In Transit.
- With DAP, in-transit quantity still counts with the **source** location's inventory.
- Once in transit, Item / Quantity / Location can no longer be changed on the order.
- Only **inventory and assembly items** can go on a transfer order, and only available stock is committed.
- Lines **cannot be partially fulfilled or received** unless `Use Item Cost as Transfer Cost` is enabled
  for that order; then a partial receipt must match the partial fulfillment.
- A line can be closed only when its in-transit quantity is zero. After closing, you cannot change the
  receipt quantity or create/delete a linked item receipt (`fid=section_N2316558`).
- `Firmed` transfer orders cannot be rescheduled or cancelled and their lines cannot be reallocated.
- `Exclude from Supply Planning` removes the transaction from the planning repository.

### Transfer order preferences

`Setup > Accounting > Preferences > Accounting Preferences > Order Management` (`fid=section_N2310077`):

- `Default Transfer Order Status`: Pending Approval Firm / Pending Approval Open / Pending Fulfillment.
- `Generate Transfer Orders in Supply Planning` (only with Supply Planning features enabled).
- `Use Item Cost as Transfer Cost` — when checked, transfer price is a declared shipping value only and
  does not affect inventory costing; applies to Standard-costing items, using standard cost at the source.
  When cleared, the transfer price *is* the item cost on the receipt, and the difference between actual
  cost and transfer price posts to a **Gain/Loss** account at shipment. **If no transfer price is entered,
  no cost is recorded on the item receipt.** Cannot be changed after the order is saved or approved.
- `Default Transfer Order Incoterms` and `Default Lead Time Between Locations`.

### Incoterms / in-transit ownership

`EXW` (Ex Works) = ownership transfers at the shipping point; `DAP` = at the destination
(`fid=section_4813066512`). Only EXW or DAP are selectable at creation; other incoterms become available
once the order is pending approval/fulfillment. Custom incoterms can be added under Accounting Lists.

**Closed-period trap:** with `Create and Edit Inventory Transactions Dated in Closed Periods` enabled you
cannot select EXW; and once any transfer order has used EXW, that preference is no longer available.

Quantity effects:

- **DAP** — fulfillment: source On Hand ↓, source In Transit ↑, destination On Order ↑. Receipt:
  destination On Hand ↑, source In Transit ↓, destination On Order ↓.
- **EXW** — fulfillment: source On Hand ↓, **destination** In Transit ↑, destination On Order ↑.
  Receipt: destination On Hand ↑, destination In Transit ↓, destination On Order ↓.

### Landed cost caveat

If inventory costing recalculates costs on a transfer order receipt, previously allocated landed cost is
**not** re-allocated (`fid=section_N2312912`).

### Replenishment and withdrawal

- **Replenish Location by Inventory Transfer** — worksheet; creates a *basic* inventory transfer
  (`fid=section_4666984549`).
- **Replenish Location by Transfer Order** — requires MLI **and** AIM; creates transfer orders
  (`fid=section_4666985845`). Items appear only when stock is at or below the location's reorder point,
  and **items with a blank Reorder Point or Preferred Stock Level are excluded entirely** (0 is a valid
  threshold; blank is not). `Create Transfer Order Based on Available Quantity` switches the suggested
  quantity from demand-driven to supply-driven; when supply-driven, `Shortage Calculation Method` offers
  Distribute Manually / Distribute Evenly Across Locations / Distribute By Percentage of Total Requested.
  Reorder multiples are respected and can force a **zero** recommendation when the multiple cannot be met.
  Lead time resolves: Bill of Distribution → item record → Inventory Management preferences.
  Same parent subsidiary → transfer order; different parent → intercompany transfer order.
- **Withdraw by Transfer Order** — pull stock out of many locations into one
  (`fid=section_4667027605`). Orders consolidate when From and To locations match. Both replenish and
  withdraw have their own submission Status pages.

## Adjustments and counts

| Form | Costing effect | Lot/serial items |
|---|---|---|
| **Inventory Adjustment** (`Adjust Inventory`) | **preserves** LIFO/FIFO costing history | supported, via Serial/Lot column or Inventory Detail |
| **Inventory Worksheet** (`Adjust Inventory Worksheet`) | **averages** cost; LIFO/FIFO history is lost | **excluded from the list entirely** |

Both cap at roughly 1000 item lines. Sources: `fid=section_161981111273`, `fid=section_161981128590`.

Worksheet specifics: the adjustment is *exclusive of previous stock totals* — the count stays as entered
as of the worksheet date even if you later enter earlier-dated transactions. `Transaction Order`
(First in Day / Last in Day) controls posting order within the day. Estimated Total Value is the *change*
in valuation, not the new value. Backdated worksheets may not reflect immediately; a scheduled task
adjusts affected quantities. Adjusting an assembly's quantity does not change member item quantities.

Same-date calculation order for On Hand: Adjust Inventory Worksheet/Distributions → Adjust Inventory →
Receive PO → Bill Payment → Bill Credit → Item Fulfillment → Invoice/Cash Sale → Credit Memo/RA Receipts.

`Inventory > Inventory > Review Negative Inventory` lists items negative as of a date, filterable by
location; run it **before** distributing inventory, and it is a required period-close task
(`fid=section_N2268458`).

Underwater inventory (selling below zero on hand) shifts costing to a later date and skews period
reports. NetSuite's mitigations: prompt receipts dated on the actual receipt date, always sell and fulfill
from sales orders, set `Fulfill Based on Commitment` to **Limit to Committed**, avoid standalone cash
sales and invoices, enable Inventory Level Warnings, count physically, use Review Negative Inventory
(`fid=section_N2264208`).

## Selling and fulfillment

- Commit options per line: `Available Qty` (unavailable goes on backorder) · `Complete Qty` (line ships
  only when fully committed) · `Do Not Commit` (`fid=section_N2281482`).
- `Ship Complete` on the customer record or the transaction's Shipping subtab keeps an order out of the
  fulfillment queue until everything is available. Bulk fulfillment can filter with
  `Respect Ship Complete`.
- Drop-ship and special-order items are **not committed** and do not affect commitment counts.
- `Perform Item Commitment After Transaction Entry` commits as each transaction is entered or approved.
- **Advanced Shipping** splits fulfillment from invoicing; without it, fulfilling creates the invoice
  (`fid=section_N2281951`).
- `Fulfill Based on Commitment` preference: `Ignore Commitment` (quantity field disabled on the
  fulfillment) · `Allow Uncommitted` (adjust quantity manually up to the line quantity) ·
  `Limit to Committed` (Fulfill button hidden unless a line is fully committed).
- Fulfillability by item type: always fulfillable/receivable — Assembly, Kit, Inventory, Non-inventory;
  never — Group, Description, Discount, Markup, Payment, Download; configurable — Gift Certificate,
  Other Charge, Service.
- **Pick, Pack, and Ship** = Fulfill Orders → Mark Orders Packed → Mark Orders Shipped. Transfer order
  lines cannot be partially picked/packed/shipped unless `Use Item Cost as Transfer Cost` is on
  (`fid=section_N2312623`).
- Backorders: receiving a PO commits stock to existing backorders automatically; `Reallocate Items`
  manually re-points that stock at different open orders (`fid=section_N2263962`).

## Stock level vocabulary

From `fid=section_N2262573`. Use these definitions verbatim in UI copy so our numbers reconcile with
NetSuite's:

- **Quantity Available** = On Hand − Committed. Never negative: an item is either non-available (0) or a
  positive quantity.
- **Quantity On Hand** = currently stocked, *including* Committed.
- **Quantity Committed** = promised on approved, unfulfilled sales orders.
- **Quantity On Order** = on approved POs pending receipt; also includes approved transfer orders.
- **Quantity To Order** = Preferred Stock Level − Available.
- **Quantity Back Ordered** = committed to sales with no stock to fill.
- **Reorder Point** / **Preferred Stock Level** / **Safety Stock** as normally understood.

Item record views: Purchasing/Inventory subtab (settings + per-location quantities), Bin Numbers subtab
(per-bin), Inventory Detail subtab (per attribute including bins), Locations subtab `Qty in Transit`,
Lot Numbers subtab `Qty in Transit`. Useful saved-search types: **Inventory Balance Search** (on-hand vs
available, including status) and **Inventory Detail Search** (per-detail-line impact).

## Transfer order reporting

Transaction searches expose Transfer Location (To Location), Location, Order Status, and Order Number as
criteria; and Transfer Order Quantity Committed / Fulfilled / Packed / Picked / Received / Shipped,
Transfer Order Line Type, and Transfer Order Item Line ID as result columns. Reports: Transfer Order
Register, Inventory Backorder, Inventory Pending Fulfillment, Shipping; Current Inventory Snapshot has an
In Transit column. Reminder: `Transfer Orders to Approve` (`fid=section_N2309511`).

Customization: transfer orders support Linked Forms (e.g. a custom picking ticket used by default when
fulfilling) and custom Transaction Body / Column Fields / Item Options via the
Applies To > Transfer Order checkbox (`fid=section_N2313259`).
