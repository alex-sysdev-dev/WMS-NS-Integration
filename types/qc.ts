/**
 * Quality control splits into two distinct surfaces at LED Connection:
 *
 *   Fabrication QC — did the fab team's build come out right, before it ships
 *   to a venue where a defect becomes a site visit.
 *
 *   Warehouse QC  — is the inventory record trustworthy: bin/lot accuracy,
 *   count coverage, and variance.
 *
 * Warehouse QC is entirely greenfield. NetSuite has zero Inventory Adjustments
 * account-wide, which means no cycle count has ever been reconciled in the
 * system, so there is no baseline error rate to inherit. Balances are tracked at
 * item + lot + bin, so a view keyed on item + bin alone can hide a second lot
 * sitting in the same bin.
 */

export type InspectionResult = 'pass' | 'fail' | 'rework' | 'pending'

/** QC on a fabricated build, before it is released to ship. */
export interface FabricationInspection {
  id: string
  requestNumber: string
  projectNumber: string
  projectName: string
  inspector: string | null
  result: InspectionResult
  defectCount: number
  notes: string | null
  inspectedAt: string | null
}

export interface FabricationQcKpis {
  awaitingInspection: number
  passed: number
  failed: number
  reworkOpen: number
  passRate: number
}

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
