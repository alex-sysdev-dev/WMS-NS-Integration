/**
 * The fabrication team, and the two things the floor is measured on.
 *
 * This is a roster, not a workforce management system. LED Connection's
 * fabrication team is four people, it is stable, and it does not warrant a
 * table. What it does warrant is one honest place that says who reports to
 * whom and what each person's numbers are, so the manager view and the QC view
 * agree on the roster rather than each deriving its own.
 *
 * Identity here is deliberately not tied to a login. Omar is a temp with no
 * Microsoft account, and a roster that can only describe people who can
 * authenticate is a roster that cannot describe the fab team. `netsuiteId` and
 * `authSubject` are therefore both nullable, and a member with neither is still
 * a first-class member whose time can be attributed by badge scan.
 */

export type FabTeamRole =
  | 'fabrication_manager'
  | 'quality_control'
  | 'fabrication_associate'

export const FAB_TEAM_ROLE_LABELS: Record<FabTeamRole, string> = {
  fabrication_manager: 'Fabrication Manager',
  quality_control: 'Fabrication Quality Control',
  fabrication_associate: 'Fabrication Associate',
}

/**
 * Which surface a member lands on at sign-in. The station view is not a
 * narrower version of the manager view; it is a separate route with no path
 * back into the rest of the app, because the fab laptops are shared and a
 * hidden nav item is not a boundary.
 */
export type FabSurface = 'station' | 'qc' | 'manager'

export const FAB_SURFACE_BY_ROLE: Record<FabTeamRole, FabSurface> = {
  fabrication_manager: 'manager',
  quality_control: 'qc',
  fabrication_associate: 'station',
}

export interface FabTeamMember {
  /** Stable slug used in routes. Not a NetSuite key. */
  id: string
  fullName: string
  role: FabTeamRole
  /** id of the member this person reports to. null at the top of the fab org. */
  managerId: string | null
  /** Temps do not get Microsoft accounts, which drives the whole auth design. */
  employmentType: 'staff' | 'temp'
  /** NetSuite employee internal id, once fabrication is integrated. */
  netsuiteId: string | null
  /**
   * Entra object id, for the members who can actually SSO. Immutable, and the
   * preferred match, but only knowable after a first sign-in.
   */
  authSubject: string | null
  /**
   * LED Microsoft address, used to seed the roster before anyone has signed
   * in. An email can be reassigned where an object id cannot, so this is the
   * bootstrap match and `authSubject` takes precedence once it is populated.
   */
  entraUpn: string | null
  /**
   * Initials as they appear in the fabrication quality tracker, which logs
   * people as "BL" or "JP" as often as by name. Kept so historical inspections
   * can be matched to a member without guessing.
   */
  trackerInitials: string[]
  /** Managers are reachable from the section index, not the sidebar list. */
  showInSidebar: boolean
}

/* ------------------------------------------------------------------------- *
 * Throughput
 *
 * Two different numbers get called "tact time" at LED Connection and they are
 * not interchangeable:
 *
 *   - The Assembly Progress Board tracks planned versus completed units per
 *     hour block. That is a schedule adherence measure and it belongs to the
 *     shift, not to a person.
 *   - A fab run's tact is hands-on active time divided by units complete. That
 *     is a labor measure and it does belong to a person.
 *
 * This shape is the second one. `avgTactMs` is null rather than zero when a
 * member has completed no units, because "no data" and "instant" are not the
 * same claim.
 * ------------------------------------------------------------------------- */

export interface FabThroughputMetrics {
  runsCompleted: number
  unitsComplete: number
  /** Hands-on milliseconds, summed from run segments. Excludes pauses. */
  activeMs: number
  /** Mean active time per unit produced. Null when no units were produced. */
  avgTactMs: number | null
  /** Mean hands-on time per completed build. Null when no builds completed. */
  avgBuildMs: number | null
}

/* ------------------------------------------------------------------------- *
 * Quality
 *
 * Fabrication quality starts from zero. No historical record is carried
 * forward and nothing is inferred from the retired spreadsheets.
 *
 * One rule survives from how the floor actually works, because it constrains
 * every quality record written from here on: a build is done by a crew, so an
 * inspection covers a crew. A defect found on that lot is not attributable to
 * any one person unless the inspector says so explicitly.
 *
 * `attribution` therefore travels with every quality figure. A crew figure is
 * true of the crew and says nothing about an individual in it, and the UI must
 * never render it as a personal metric.
 * ------------------------------------------------------------------------- */

export type QualityAttribution = 'individual' | 'crew'

/** The tracker's own failure code table, carried over unchanged. */
export const FAB_FAILURE_CODES = {
  M1: 'Measurement Off Spec',
  D1: 'Damaged Surface',
  A1: 'Assembly Error',
  FD: 'Factory Defect',
  F1: 'Finish Imperfection',
  O1: 'Other',
} as const

export type FabFailureCode = keyof typeof FAB_FAILURE_CODES

export interface FabQualityMetrics {
  inspections: number
  qtyInspected: number
  qtyPassed: number
  qtyFailed: number
  /** Passed over inspected, 0-100. Null when nothing was inspected. */
  passRate: number | null
  reworkCount: number
  /**
   * Whether these figures describe this person or the crew they worked in.
   * Null when there is nothing to attribute.
   */
  attribution: QualityAttribution | null
}

/** One inspection, against one fab request. */
export interface FabRequestQuality {
  id: string
  /**
   * The NetSuite document number the inspection is filed against, read from
   * NetSuite and never generated here. An inspection that cannot name a real
   * document is an inspection nobody can look up later.
   */
  requestNumber: string
  projectNumber: string
  itemName: string
  /** Everyone credited on the build. One entry is an individual attribution. */
  fabricatorIds: string[]
  /** Free-text crew string as logged, kept when it cannot be resolved to ids. */
  fabricatorLabel: string
  qtyInspected: number
  qtyPassed: number
  qtyFailed: number
  failureCodes: FabFailureCode[]
  reworkDone: boolean
  /** Member id of the inspector, when resolvable. */
  inspectorId: string | null
  comments: string | null
  inspectedAt: string
}

export interface FabTeamMemberSummary {
  member: FabTeamMember
  manager: FabTeamMember | null
  throughput: FabThroughputMetrics
  quality: FabQualityMetrics
}
