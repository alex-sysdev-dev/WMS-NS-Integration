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
  /**
   * The NetSuite document number, read as-is.
   *
   * The app never generates this. Fabrication is moving into NetSuite, so
   * NetSuite issues the number and every other system quotes it. A counter
   * here would immediately diverge from the record anyone actually opens, and
   * two numbers for one build is worse than the hand-typed folder names it
   * would have replaced.
   */
  requestNumber: string
  /** NetSuite job / project number, the primary operational key. */
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

/* ------------------------------------------------------------------------- *
 * Tact time
 *
 * The floor needs one honest number per build: how long the bench was actually
 * working on it. That is not "stop minus start", because a build gets paused
 * for lunch, for a missing part, for a QC question. So the only timing
 * primitive stored is a segment, and a run's active time is the sum of its
 * segments. Nothing stores a duration, which means no cached total can ever
 * drift from the segments that produced it.
 *
 * A run is running when it has exactly one open segment (endedAt === null).
 * Pausing closes it. Switching steps closes one and opens the next. Stopping
 * closes it and stamps endedAt on the run.
 *
 * Tact time is active time divided by units complete, so a run that produced
 * nothing has no tact time rather than a misleading zero.
 * ------------------------------------------------------------------------- */

/**
 * Default step chips on the console. Free text is accepted too, because the
 * bench will name a step this list does not have and typing it is better than
 * logging it as something it is not.
 */
export const FAB_STEPS = [
  'Frame',
  'Wiring',
  'Panel Mount',
  'Power / Data',
  'Test',
  'Pack',
] as const

export type FabRunState = 'running' | 'paused' | 'complete'

/** One continuous stretch of hands-on time, attributed to a named step. */
export interface FabRunSegment {
  id: string
  step: string
  startedAt: string
  /** null while the clock is running on this segment. */
  endedAt: string | null
}

export interface FabRun {
  id: string
  /** NetSuite job / project number. The operational key, same as the queue. */
  projectNumber: string
  /**
   * The NetSuite document number for the build this run is against. Read from
   * NetSuite, never generated. Null until fabrication is integrated and a run
   * can be tied to a real document.
   */
  requestNumber: string | null
  description: string
  /** FAB1 through FAB9. */
  fabBin: string | null
  /** What the build is expected to produce. Drives the tact target. */
  targetUnits: number
  unitsComplete: number
  /** Display name of whoever was signed in when the run was started. */
  operator: string
  operatorId: string
  state: FabRunState
  startedAt: string
  endedAt: string | null
  segments: FabRunSegment[]
  notes: string | null
  updatedAt: string
}

export interface FabTactKpis {
  /** Runs with the clock currently ticking. */
  activeRuns: number
  /** Runs started today and still open, clock ticking or paused. */
  openRuns: number
  runsCompletedToday: number
  unitsToday: number
  /** Hands-on hours logged against runs started today. */
  activeHoursToday: number
  /** Mean tact across completed runs that produced units. Null if none did. */
  avgTactMs: number | null
  /** Mean hands-on time per completed build. */
  avgBuildMs: number | null
}

/* ------------------------------------------------------------------------- *
 * Project lookup
 *
 * The bench types a project number and the rest of the start form fills
 * itself. This exists to cut typing, but the larger win is validation: today
 * nothing catches KR-00459-UT typed for KR-00495-UT, and the run is logged
 * against a project that does not exist. A lookup that fails loudly on an
 * unknown number prevents that whole class of error.
 * ------------------------------------------------------------------------- */

/** One build under a project. Empty until fab requests exist in NetSuite. */
export interface ProjectBuildOption {
  /** NetSuite document number, read never generated. */
  requestNumber: string
  /** Build label off the fab sheet, such as W1 or W2. */
  label: string | null
  description: string
  targetUnits: number
}

export interface ProjectLookup {
  projectNumber: string
  projectName: string
  /** Usually the general contractor, not the venue. */
  customer: string | null
  venue: string | null
  dueAt: string | null
  stage: string | null
  /** FAB1 through FAB9, when the project already has one assigned. */
  fabBin: string | null
  /**
   * Builds available under this project. One project routinely has several,
   * so a project number alone does not identify what is being built.
   */
  builds: ProjectBuildOption[]
}

/**
 * "Could not ask" and "asked, no such project" are different facts and the UI
 * treats them differently. Never collapse them.
 */
export type ProjectLookupResult =
  | { state: 'not_connected' }
  | { state: 'not_found'; projectNumber: string }
  | { state: 'found'; project: ProjectLookup }

/* ------------------------------------------------------------------------- *
 * Build documents
 *
 * Fab sheets and diagrams live outside this app. Today they are attached in
 * monday.com; monday is being retired and fabrication is moving into NetSuite,
 * so the document panel deliberately stores a link plus a source label rather
 * than assuming either system. The WMS never stores a copy of a fab sheet,
 * which means there is exactly one version of it and it is the one held by the
 * system of record.
 *
 * Migrating a document is then a one field change: repoint url, flip source
 * from 'monday' to 'netsuite'. No UI, API, or store change.
 * ------------------------------------------------------------------------- */

export type FabDocKind = 'fab_sheet' | 'diagram' | 'cut_list' | 'photo' | 'other'

/** Where the file actually lives. Shown on the tile so the floor knows. */
export type FabDocSource = 'monday' | 'netsuite' | 'sharepoint' | 'link'

export interface FabDocLink {
  id: string
  /** Project number this belongs to, or '*' for a document every build uses. */
  projectNumber: string
  label: string
  kind: FabDocKind
  source: FabDocSource
  /** Link to the file in its system of record. Opens in a new tab. */
  url: string
  /**
   * Optional embed link, for the sources that permit framing. When present the
   * document renders inline on the console. A monday.com asset link and a plain
   * SharePoint share link both refuse to be framed, so this stays null for them
   * and the tile opens a new tab instead.
   */
  embedUrl: string | null
  addedBy: string
  addedAt: string
}
