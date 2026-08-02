/**
 * Warehouse KPIs for LED Connection.
 *
 * These replace the fulfillment-center metrics the donor UI shipped with
 * (throughput per hour, CPT risk, yard occupancy, trailer dwell). None of those
 * describe this operation: there is no yard, no trailers, no parcel cut-off
 * times, and material is bought per project rather than stocked and picked
 * against a forecast.
 *
 * The pipeline counts map to NetSuite job stages on `job.custentity3`:
 *   12 - Material Received -> 13 - Fabrication -> 14 - Ready to Ship
 *   -> 15 - Partially Shipped -> 16 - Fully Shipped to Client
 *
 * Every field is nullable. Null means "not measured yet" and renders as
 * "Pending" — it must never be shown as a zero, because a real zero and an
 * unwired metric mean very different things to someone reading the floor.
 */

export interface WarehouseKpiSnapshot {
  /** Null until a NetSuite sync has run. */
  snapshotAt: string | null

  // Project pipeline — the core of the operation.
  projectsMaterialReceived: number | null
  projectsInFabrication: number | null
  projectsReadyToShip: number | null
  projectsPartiallyShipped: number | null

  // Material flow.
  openPurchaseOrders: number | null
  projectsShortMaterial: number | null
  shipmentsThisWeek: number | null
  shipmentsThisMonth: number | null

  // Fabrication and quality.
  openFabRequests: number | null
  fabQcHolds: number | null
  binsNeverCounted: number | null
  openInventoryVariances: number | null
}

export interface ProjectAttentionRow {
  id: string
  projectNumber: string
  projectName: string
  customer: string
  stage: string
  /** Why this project needs attention, e.g. "3 lines short". */
  reason: string
  installDate: string | null
}

export const EMPTY_WAREHOUSE_KPIS: WarehouseKpiSnapshot = {
  snapshotAt: null,
  projectsMaterialReceived: null,
  projectsInFabrication: null,
  projectsReadyToShip: null,
  projectsPartiallyShipped: null,
  openPurchaseOrders: null,
  projectsShortMaterial: null,
  shipmentsThisWeek: null,
  shipmentsThisMonth: null,
  openFabRequests: null,
  fabQcHolds: null,
  binsNeverCounted: null,
  openInventoryVariances: null,
}
