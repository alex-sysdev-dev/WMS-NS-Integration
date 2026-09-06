/**
 * Warehouse QC asks one question: is the inventory record trustworthy.
 * That means bin and lot accuracy, count coverage, and variance.
 *
 * It is entirely greenfield. NetSuite has zero Inventory Adjustments
 * account-wide, which means no cycle count has ever been reconciled in the
 * system, so there is no baseline error rate to inherit. Balances are tracked
 * at item + lot + bin, so a view keyed on item + bin alone can hide a second
 * lot sitting in the same bin.
 *
 * Fabrication quality is a separate model and lives in `types/fab-team.ts`.
 * It is not an inventory question and does not share these shapes.
 */

export type InventoryHealthStatus = 'ok' | 'watch' | 'variance' | 'uncounted'

/** One item + lot + bin balance, with count history. */
export interface InventoryHealthRow {
  id: string
  itemId: string
  itemName: string
  lotNumber: string | null
  binNumber: string
  onHandQty: number
  committedQty: number
  availableQty: number
  lastCountedAt: string | null
  varianceQty: number
  status: InventoryHealthStatus
}

export interface WarehouseQcKpis {
  binsInUse: number
  binsDefined: number
  itemLotBinRecords: number
  neverCounted: number
  openVariances: number
  countCoverage: number
}
