import { InboundItem, Shipment } from '@/types/inbound'

/**
 * Inbound has no source yet.
 *
 * These reads used to hit the `inbound_shipments` and `inbound_items` tables
 * carried over from the scaffolding this project was started from. That store
 * is gone and NetSuite is the only datastore, so the honest state is empty
 * until inbound is wired to NetSuite.
 *
 * Inbound is not a straight port. LED Connection records receipts against the
 * Vendor Bill, not the Item Receipt, because zero Item Receipts exist
 * account-wide and the Vendor Bill is what carries the Inventory Detail
 * subrecord. Whatever replaces this reads vendor bills, and every line it
 * returns has to carry item, lot, and bin, since inventory is lot-tracked and
 * never serialized.
 *
 * Callers render an empty state with a visible notice. An unconnected page and
 * a page with genuinely nothing on it must not look the same.
 */

export const INBOUND_SOURCE_READY = false

export async function getInboundShipments(): Promise<Shipment[]> {
  return []
}

export async function getInboundItems(): Promise<InboundItem[]> {
  return []
}
