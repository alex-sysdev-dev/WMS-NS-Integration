/**
 * Fabrication is owned by this WMS, not by NetSuite.
 *
 * LED Connection's NetSuite account has zero Work Orders, zero Assembly Builds,
 * and zero Kit items, yet fabrication demonstrably happens: there are nine
 * dedicated FAB1-FAB9 bins and a "13 - Fabrication" stage in the project
 * pipeline. Rather than force NetSuite Assembly BOMs onto a team that has never
 * used them, the WMS models fabrication natively and syncs only net inventory
 * effects back.
 *
 * Two constraints from the live account drive these shapes:
 *   1. The project (NetSuite `job`) is the unit of work, not the sales order.
 *      541 of 547 sales orders carry a job, so the project is the reliable key.
 *   2. Inventory is lot-tracked and never serialized (3,037 lot / 0 serial).
 *      Every component movement therefore carries a lot number, and a single
 *      requirement may be satisfied from more than one lot.
 */

export type FabricationStatus =
  | 'requested'
  | 'queued'
  | 'in_progress'
  | 'qc_hold'
  | 'complete'
  | 'cancelled'

export interface FabricationRequest {
  id: string
  requestNumber: string
  /** NetSuite job / project number — the primary operational key. */
  projectNumber: string
  projectName: string
  /** Usually the general contractor, not the venue. */
  customer: string
  /** Venue such as MGM or Luxor, which typically lives in the project name. */
  venue: string | null
  salesOrderNumber: string | null
  description: string
  /** FAB1 through FAB9. */
  fabBin: string | null
  status: FabricationStatus
  assignedTo: string | null
  requestedAt: string | null
  dueAt: string | null
  completedAt: string | null
}

/** A raw part consumed by a fabrication request. Always lot-qualified. */
export interface FabricationComponent {
  id: string
  requestNumber: string
  itemId: string
  itemName: string
  lotNumber: string | null
  binNumber: string | null
  requiredQty: number
  stagedQty: number
  consumedQty: number
  shortQty: number
}

export interface FabricationKpis {
  openRequests: number
  queued: number
  inProgress: number
  qcHold: number
  completedThisMonth: number
  shortComponents: number
}
