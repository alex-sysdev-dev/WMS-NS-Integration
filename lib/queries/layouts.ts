import type { FacilityLayoutData } from '@/types/layout'

/**
 * Floor layouts have no source yet.
 *
 * These read the `facility_layouts` and `facility_layout_items` tables from
 * the scaffolding this project was started from. That store is gone and
 * NetSuite is the only datastore, so this returns an empty layout until the
 * floor plan has a home.
 *
 * Layout geometry is the one thing here with no natural NetSuite record. Bins
 * are real and live in NetSuite (FAB1 through FAB9, and the rest), but where a
 * bin sits in x/y space on a floor plan is presentation, not inventory. That
 * needs either a NetSuite custom record or an argued exception, and it is the
 * open question to settle before anything renders a floor plan again.
 *
 * Callers render an empty state with a visible notice rather than a blank grid
 * that reads as a facility with nothing in it.
 */

export const LAYOUT_SOURCE_READY = false

const EMPTY_LAYOUT: FacilityLayoutData = { layout: null, items: [] }

export async function getFacilityLayoutData(_code: string): Promise<FacilityLayoutData> {
  return EMPTY_LAYOUT
}
