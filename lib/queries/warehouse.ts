import { EMPTY_WAREHOUSE_KPIS, type ProjectAttentionRow, type WarehouseKpiSnapshot } from '@/types/warehouse'

/**
 * Warehouse KPI reads.
 *
 * Not yet connected. These return empty results on purpose rather than sample
 * numbers, so an unwired dashboard is visibly distinguishable from a working
 * one. Fabricated demo data is what made the donor project misleading.
 *
 * When wiring these to NetSuite, the queries are:
 *
 *   Pipeline counts — group active jobs by stage:
 *     SELECT j.custentity3, COUNT(*) FROM job j
 *     WHERE j.isinactive = 'F' AND j.subsidiary = 2
 *     GROUP BY j.custentity3
 *
 *   Shipments — Item Fulfillments are the real outbound event:
 *     SELECT COUNT(*) FROM transaction t
 *     WHERE t.type = 'ItemShip' AND t.subsidiary = 2
 *       AND t.trandate BETWEEN TO_DATE(...) AND TO_DATE(...)
 *
 *   Bins never counted — location 1 is the only location with bin inventory:
 *     SELECT COUNT(DISTINCT binnumber) FROM inventorybalance WHERE location = 1
 *
 * Note SuiteQL is Oracle-flavored: no CTEs, `||` for concatenation, and `>` / `<`
 * get HTML-escaped in transit, so prefer BETWEEN.
 *
 * Fabrication and variance counts have no NetSuite source at all — the account
 * has zero work orders, zero assembly builds, and zero inventory adjustments.
 * Those come from this WMS's own tables once fabrication is live.
 */

export async function getWarehouseKpis(): Promise<WarehouseKpiSnapshot> {
  return EMPTY_WAREHOUSE_KPIS
}

export async function getProjectsNeedingAttention(): Promise<ProjectAttentionRow[]> {
  return []
}
