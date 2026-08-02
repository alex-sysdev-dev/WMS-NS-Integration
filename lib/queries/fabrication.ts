import type {
  FabricationComponent,
  FabricationKpis,
  FabricationRequest,
} from '@/types/fabrication'

/**
 * NOT YET CONNECTED.
 *
 * Fabrication has no backing store yet. These functions deliberately return
 * empty results rather than sample data — the pages render real structure with
 * honest empty states, so nothing on screen can be mistaken for live operations.
 *
 * Wiring this up requires two decisions that are still open:
 *
 *   1. Where fabrication requests live. They do not exist in NetSuite (zero Work
 *      Orders, zero Assembly Builds), so the WMS owns them. That means a local
 *      table keyed on the NetSuite project number.
 *
 *   2. How component consumption posts back. Consuming raw lots and producing a
 *      built item changes inventory, and NetSuite has no Assembly Build history
 *      to append to. Any write must be proven against sandbox first — never
 *      against a live record.
 */

export const FABRICATION_DATA_SOURCE_READY = false

export async function getFabricationRequests(): Promise<FabricationRequest[]> {
  return []
}

export async function getFabricationComponents(): Promise<FabricationComponent[]> {
  return []
}

export function calculateFabricationKpis(
  requests: FabricationRequest[],
  components: FabricationComponent[]
): FabricationKpis {
  const openStatuses = new Set(['requested', 'queued', 'in_progress', 'qc_hold'])
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  return {
    openRequests: requests.filter((r) => openStatuses.has(r.status)).length,
    queued: requests.filter((r) => r.status === 'queued').length,
    inProgress: requests.filter((r) => r.status === 'in_progress').length,
    qcHold: requests.filter((r) => r.status === 'qc_hold').length,
    completedThisMonth: requests.filter((r) => {
      if (r.status !== 'complete' || !r.completedAt) {
        return false
      }
      const completed = Date.parse(r.completedAt)
      return Number.isFinite(completed) && completed >= monthStart
    }).length,
    shortComponents: components.filter((c) => c.shortQty > 0).length,
  }
}
