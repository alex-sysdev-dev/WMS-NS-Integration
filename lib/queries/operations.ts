import { getInboundItems } from '@/lib/queries/inbound'
import { getInboundQaQueue, getInventoryView } from '@/lib/queries/outbound'

/**
 * No source. This probed a list of candidate scaffolding task tables and
 * returned the count from the first one that answered. Supabase is gone, so it
 * returns null, which callers already treat as "unknown" rather than zero.
 *
 * Null matters here. Zero open putaway tasks and no way to count them are
 * different facts, and only one of them should read as a clear board.
 */
async function getFirstOpenTaskCount(_tableNames: string[]): Promise<number | null> {
  return null
}

export async function getCrossFunctionalKpis(): Promise<{
  inventoryRiskSkus: number
  inboundQaPending: number
  inboundQaBlocked: number
}> {
  const [inventory, inboundQaQueue] = await Promise.all([getInventoryView(), getInboundQaQueue()])

  return {
    inventoryRiskSkus: inventory.filter((item) => item.risk !== 'healthy').length,
    inboundQaPending: inboundQaQueue.filter((entry) => entry.queueState === 'qa_pending').length,
    inboundQaBlocked: inboundQaQueue.filter((entry) => entry.queueState === 'blocked').length,
  }
}

export async function getPutawayTasksCount(): Promise<number> {
  const countFromTables = await getFirstOpenTaskCount(['putaway_tasks', 'putaway_task'])
  if (countFromTables !== null) {
    return countFromTables
  }

  const items = await getInboundItems()
  return items.filter((item) => item.received_qty > 0).length
}

export async function getCycleCountTasksCount(): Promise<number> {
  const countFromTables = await getFirstOpenTaskCount(['cycle_counts', 'cycle_count_tasks', 'cyclecount_tasks'])
  if (countFromTables !== null) {
    return countFromTables
  }

  const inventory = await getInventoryView()
  return inventory.filter((item) => item.risk !== 'healthy').length
}
