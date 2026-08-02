import type {
  FabricationInspection,
  FabricationQcKpis,
  InventoryHealthRow,
  WarehouseQcKpis,
} from '@/types/qc'

/**
 * NOT YET CONNECTED.
 *
 * Both QC surfaces return empty results until their sources are wired. As with
 * fabrication, no sample data is fabricated here.
 *
 * Fabrication QC is WMS-owned — there is nothing in NetSuite to read.
 *
 * Warehouse QC should read from NetSuite's `inventorybalance` table, which is
 * the correct source for item + lot + bin balances (`inventoryitemlocations`
 * does not exist). At last check that table held roughly 760 item/bin
 * combinations across 329 of 501 bins, all at the Headquarters location — small
 * enough to full-refresh on a short interval rather than building incremental
 * delta logic.
 *
 * The bin counts below are the known static shape of the warehouse and are safe
 * to show; the per-record health data is not available yet.
 */

export const QC_DATA_SOURCE_READY = false

/** Verified against the live account: 501 bins defined, 329 carrying stock. */
export const BINS_DEFINED = 501
export const BINS_IN_USE = 329

export async function getFabricationInspections(): Promise<FabricationInspection[]> {
  return []
}

export function calculateFabricationQcKpis(
  inspections: FabricationInspection[]
): FabricationQcKpis {
  const passed = inspections.filter((i) => i.result === 'pass').length
  const failed = inspections.filter((i) => i.result === 'fail').length
  const decided = passed + failed

  return {
    awaitingInspection: inspections.filter((i) => i.result === 'pending').length,
    passed,
    failed,
    reworkOpen: inspections.filter((i) => i.result === 'rework').length,
    passRate: decided > 0 ? Number(((passed / decided) * 100).toFixed(1)) : 0,
  }
}

export async function getInventoryHealth(): Promise<InventoryHealthRow[]> {
  return []
}

export function calculateWarehouseQcKpis(rows: InventoryHealthRow[]): WarehouseQcKpis {
  const neverCounted = rows.filter((r) => !r.lastCountedAt).length
  const counted = rows.length - neverCounted

  return {
    binsInUse: BINS_IN_USE,
    binsDefined: BINS_DEFINED,
    itemLotBinRecords: rows.length,
    neverCounted,
    openVariances: rows.filter((r) => r.varianceQty !== 0).length,
    countCoverage: rows.length > 0 ? Number(((counted / rows.length) * 100).toFixed(1)) : 0,
  }
}
