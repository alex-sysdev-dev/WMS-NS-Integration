import type {
  ExecutiveCptRiskOrder,
  ExecutiveKpiForecastRow,
  ExecutiveKpiHistoryRow,
  ExecutiveKpiMaxLineRow,
  ExecutiveKpiSnapshot,
} from '@/types/executive'

/**
 * Executive KPIs have no source, and most of them never described LED
 * Connection in the first place.
 *
 * These read `executive_kpi_snapshot`, `executive_kpi_max_lines`,
 * `executive_kpi_forecast_daily`, and `order_cpt_risk`, all inherited from the
 * scaffolding this project was started from. That store is gone and NetSuite
 * is the only datastore, so every one of them returns empty.
 *
 * Do not port these shapes to NetSuite as they stand. CPT (critical pull time)
 * risk is a parcel-carrier concept that never described LED Connection: it
 * assumes orders race a daily carrier cutoff. LED ships project freight through
 * Rock City and Total One, the project is the unit of work rather than the
 * sales order, and there is no cutoff clock to miss. Rebuilding these against
 * NetSuite means deciding what leadership actually wants to see, not
 * translating these columns.
 *
 * Callers render an empty state with a visible notice. A dashboard of zeroes
 * must not read as a quiet day.
 */

export const EXECUTIVE_SOURCE_READY = false

export async function getExecutiveKpiSnapshot(): Promise<ExecutiveKpiSnapshot | null> {
  return null
}

export async function getExecutiveKpiMaxLines(_limit = 24): Promise<ExecutiveKpiMaxLineRow[]> {
  return []
}

export async function getExecutiveCptRiskOrders(_limit = 8): Promise<ExecutiveCptRiskOrder[]> {
  return []
}

export async function getExecutiveKpiHistoryHourly(_limit = 24): Promise<ExecutiveKpiHistoryRow[]> {
  return []
}

export async function getExecutiveKpiHistoryDaily(_limit = 14): Promise<ExecutiveKpiHistoryRow[]> {
  return []
}

export async function getExecutiveKpiForecastDaily(_limit = 14): Promise<ExecutiveKpiForecastRow[]> {
  return []
}
