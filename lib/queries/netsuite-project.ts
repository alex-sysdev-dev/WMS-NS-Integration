import type { ProjectLookup, ProjectLookupResult } from '@/types/fabrication'

/**
 * Project lookup, so the bench types one number instead of five fields.
 *
 * Reading NetSuite is permitted and always has been. What does not exist yet is
 * a connection from this app: the Next.js server has no NetSuite credentials,
 * no token-based auth, and no SuiteQL or RESTlet endpoint of its own. That is
 * an integration task, not a guardrail question.
 *
 * Two different states are deliberately distinguished:
 *
 *   not_connected - the app cannot ask NetSuite anything. The form stays fully
 *                   editable and nothing is validated, because a lookup that
 *                   cannot run must never read as "this project is not real".
 *   not_found     - the app asked and NetSuite does not have that project. This
 *                   is a genuine signal and the form says so.
 *
 * Collapsing those two into "no result" is how a build gets logged against a
 * mistyped project number and nobody notices for a month.
 *
 * WHAT THIS CAN AND CANNOT POPULATE
 *
 * The project (NetSuite `job`) record exists today and carries name, customer,
 * venue, due date, and stage. Those are real and populate as soon as the
 * connection exists.
 *
 * The fab request does not exist in NetSuite yet. The account has zero Work
 * Orders, zero Assembly Builds, and zero Kit items, which is exactly why
 * fabrication is being moved there. Until that record type is decided, there is
 * nothing to read for description or target units and the bench still types
 * them. `builds` returns empty rather than pretending otherwise.
 */

export const PROJECT_LOOKUP_READY = false

export async function lookupProject(projectNumber: string): Promise<ProjectLookupResult> {
  const trimmed = projectNumber.trim()

  if (!trimmed) {
    return { state: 'not_found', projectNumber: trimmed }
  }

  if (!PROJECT_LOOKUP_READY) {
    return { state: 'not_connected' }
  }

  // Replaced by a SuiteQL read against the job record once the app has NetSuite
  // credentials. Reading is allowed; only the connection is missing.
  return { state: 'not_found', projectNumber: trimmed }
}

/** Shape a resolved project takes on the way to the form. Unused until wired. */
export function toProjectLookup(row: Record<string, unknown>): ProjectLookup {
  return {
    projectNumber: String(row.entityid ?? ''),
    projectName: String(row.companyname ?? ''),
    customer: typeof row.customer === 'string' ? row.customer : null,
    venue: typeof row.venue === 'string' ? row.venue : null,
    dueAt: typeof row.enddate === 'string' ? row.enddate : null,
    stage: typeof row.entitystatus === 'string' ? row.entitystatus : null,
    fabBin: null,
    builds: [],
  }
}
