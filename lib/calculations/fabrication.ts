import type {
  FabRun,
  FabRunSegment,
  FabRunState,
  FabTactKpis,
} from '@/types/fabrication'

/**
 * Tact time math and run state transitions.
 *
 * Everything here is pure and takes `now` as an argument rather than reading
 * the clock, for two reasons. The console has to recompute a ticking timer
 * many times a second in the browser, and the API has to get the identical
 * result on the server. A function that reads Date.now() internally cannot do
 * both without the two disagreeing at the boundary.
 *
 * The stored shape has no duration field anywhere. Active time is always
 * summed from segments, so there is nothing to invalidate and no way for a
 * total to drift away from the segments that justify it.
 */

const HOUR_MS = 3_600_000

/** Milliseconds on one segment. An open segment is measured up to nowMs. */
export function segmentMs(segment: FabRunSegment, nowMs: number): number {
  const started = Date.parse(segment.startedAt)
  if (!Number.isFinite(started)) {
    return 0
  }
  const ended = segment.endedAt ? Date.parse(segment.endedAt) : nowMs
  if (!Number.isFinite(ended)) {
    return 0
  }
  return Math.max(0, ended - started)
}

/** The one segment still open, or null when the clock is not running. */
export function openSegment(run: FabRun): FabRunSegment | null {
  return run.segments.find((segment) => segment.endedAt === null) ?? null
}

/** Hands-on milliseconds. Paused stretches are absent, not subtracted. */
export function runActiveMs(run: FabRun, nowMs: number): number {
  return run.segments.reduce((total, segment) => total + segmentMs(segment, nowMs), 0)
}

/** Wall clock from first start to stop, including every pause. */
export function runElapsedMs(run: FabRun, nowMs: number): number {
  const started = Date.parse(run.startedAt)
  if (!Number.isFinite(started)) {
    return 0
  }
  const ended = run.endedAt ? Date.parse(run.endedAt) : nowMs
  return Math.max(0, (Number.isFinite(ended) ? ended : nowMs) - started)
}

/**
 * Milliseconds of hands-on time per finished unit.
 *
 * Null, never zero, when nothing has been produced yet. A run twenty minutes
 * in with no units complete has no tact time, and showing 0:00 would read as
 * an impossibly fast build rather than as missing information.
 */
export function runTactMs(run: FabRun, nowMs: number): number | null {
  if (run.unitsComplete <= 0) {
    return null
  }
  return runActiveMs(run, nowMs) / run.unitsComplete
}

/** How much of the target is done, 0 to 1. Null when there is no target. */
export function runProgress(run: FabRun): number | null {
  if (run.targetUnits <= 0) {
    return null
  }
  return Math.min(1, run.unitsComplete / run.targetUnits)
}

/**
 * "1h 24m 05s". Hours are dropped below an hour so a two minute step does not
 * read as "0h 02m", which is harder to scan down a column of short steps.
 */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  if (hours > 0) {
    return hours + 'h ' + pad(minutes) + 'm ' + pad(seconds) + 's'
  }
  if (minutes > 0) {
    return minutes + 'm ' + pad(seconds) + 's'
  }
  return seconds + 's'
}

/** Clock face for the console. Always H:MM:SS so the digits stop jumping width. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours + ':' + pad(minutes) + ':' + pad(seconds)
}

/** Tact time for a table cell. Honest text when no units are done. */
export function formatTact(ms: number | null): string {
  return ms === null ? 'no units yet' : formatDuration(ms) + ' / unit'
}

export function toHours(ms: number): number {
  return Math.round((ms / HOUR_MS) * 100) / 100
}

function startOfDayMs(nowMs: number): number {
  const now = new Date(nowMs)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function startedToday(run: FabRun, nowMs: number): boolean {
  const started = Date.parse(run.startedAt)
  return Number.isFinite(started) && started >= startOfDayMs(nowMs)
}

function completedToday(run: FabRun, nowMs: number): boolean {
  if (run.state !== 'complete' || !run.endedAt) {
    return false
  }
  const ended = Date.parse(run.endedAt)
  return Number.isFinite(ended) && ended >= startOfDayMs(nowMs)
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  return values.reduce((total, value) => total + value, 0) / values.length
}

export function calculateTactKpis(runs: FabRun[], nowMs: number): FabTactKpis {
  const completed = runs.filter((run) => run.state === 'complete')
  const completedWithUnits = completed.filter((run) => run.unitsComplete > 0)
  const finishedToday = runs.filter((run) => completedToday(run, nowMs))
  const today = runs.filter((run) => startedToday(run, nowMs))

  return {
    activeRuns: runs.filter((run) => run.state === 'running').length,
    openRuns: runs.filter((run) => run.state !== 'complete').length,
    runsCompletedToday: finishedToday.length,
    unitsToday: finishedToday.reduce((total, run) => total + run.unitsComplete, 0),
    activeHoursToday: toHours(
      today.reduce((total, run) => total + runActiveMs(run, nowMs), 0)
    ),
    avgTactMs: mean(
      completedWithUnits.map((run) => runActiveMs(run, nowMs) / run.unitsComplete)
    ),
    avgBuildMs: mean(completed.map((run) => runActiveMs(run, nowMs))),
  }
}

export type StepTotal = {
  step: string
  totalMs: number
  runCount: number
  /** Share of all logged hands-on time, 0 to 1. */
  share: number
}

/**
 * Where the time actually went, across every run passed in.
 *
 * This is the number leadership asks for after the first week. Not "how long
 * does a build take" but "which step is eating the day".
 */
export function stepTotals(runs: FabRun[], nowMs: number): StepTotal[] {
  const byStep = new Map<string, { totalMs: number; runs: Set<string> }>()

  for (const run of runs) {
    for (const segment of run.segments) {
      const entry = byStep.get(segment.step) ?? { totalMs: 0, runs: new Set<string>() }
      entry.totalMs += segmentMs(segment, nowMs)
      entry.runs.add(run.id)
      byStep.set(segment.step, entry)
    }
  }

  const grandTotal = [...byStep.values()].reduce((total, entry) => total + entry.totalMs, 0)

  return [...byStep.entries()]
    .map(([step, entry]) => ({
      step,
      totalMs: entry.totalMs,
      runCount: entry.runs.size,
      share: grandTotal > 0 ? entry.totalMs / grandTotal : 0,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

/* ------------------------------------------------------------------------- *
 * Transitions
 *
 * Each returns a new run rather than mutating, and each takes the ids and
 * timestamps it needs, so the store stays the only thing that touches a clock
 * or a uuid. That keeps every transition checkable by hand.
 * ------------------------------------------------------------------------- */

export type NewRunInput = {
  projectNumber: string
  requestNumber: string | null
  description: string
  fabBin: string | null
  targetUnits: number
  step: string
  notes: string | null
}

export type TransitionContext = {
  nowIso: string
  newId: () => string
}

export function startRun(
  input: NewRunInput,
  operator: { id: string; name: string },
  ctx: TransitionContext
): FabRun {
  return {
    id: ctx.newId(),
    projectNumber: input.projectNumber,
    requestNumber: input.requestNumber,
    description: input.description,
    fabBin: input.fabBin,
    targetUnits: input.targetUnits,
    unitsComplete: 0,
    operator: operator.name,
    operatorId: operator.id,
    state: 'running',
    startedAt: ctx.nowIso,
    endedAt: null,
    segments: [
      {
        id: ctx.newId(),
        step: input.step,
        startedAt: ctx.nowIso,
        endedAt: null,
      },
    ],
    notes: input.notes,
    updatedAt: ctx.nowIso,
  }
}

function closeOpenSegments(run: FabRun, nowIso: string): FabRunSegment[] {
  return run.segments.map((segment) =>
    segment.endedAt === null ? { ...segment, endedAt: nowIso } : segment
  )
}

/** Stops the clock without ending the build. Lunch, a missing part, a QC hold. */
export function pauseRun(run: FabRun, nowIso: string): FabRun {
  if (run.state !== 'running') {
    return run
  }
  return {
    ...run,
    state: 'paused',
    segments: closeOpenSegments(run, nowIso),
    updatedAt: nowIso,
  }
}

/** Restarts the clock on a new segment, so the pause leaves a visible gap. */
export function resumeRun(run: FabRun, step: string, ctx: TransitionContext): FabRun {
  if (run.state !== 'paused') {
    return run
  }
  return {
    ...run,
    state: 'running',
    segments: [
      ...closeOpenSegments(run, ctx.nowIso),
      { id: ctx.newId(), step, startedAt: ctx.nowIso, endedAt: null },
    ],
    updatedAt: ctx.nowIso,
  }
}

/**
 * Moves to the next step without stopping the clock. No time is lost between
 * the two segments, which is the point. The bench does not stop working just
 * because the step name changed.
 */
export function switchStep(run: FabRun, step: string, ctx: TransitionContext): FabRun {
  if (run.state === 'complete') {
    return run
  }
  const current = openSegment(run)
  if (current && current.step === step) {
    return run
  }
  return {
    ...run,
    state: 'running',
    segments: [
      ...closeOpenSegments(run, ctx.nowIso),
      { id: ctx.newId(), step, startedAt: ctx.nowIso, endedAt: null },
    ],
    updatedAt: ctx.nowIso,
  }
}

/** Ends the build. Not reversible from the floor, on purpose. */
export function stopRun(run: FabRun, nowIso: string): FabRun {
  if (run.state === 'complete') {
    return run
  }
  return {
    ...run,
    state: 'complete',
    segments: closeOpenSegments(run, nowIso),
    endedAt: nowIso,
    updatedAt: nowIso,
  }
}

export function setUnitsComplete(run: FabRun, units: number, nowIso: string): FabRun {
  const clamped = Math.max(0, Math.floor(units))
  if (clamped === run.unitsComplete) {
    return run
  }
  return { ...run, unitsComplete: clamped, updatedAt: nowIso }
}

export function setNotes(run: FabRun, notes: string | null, nowIso: string): FabRun {
  return { ...run, notes, updatedAt: nowIso }
}

export const RUN_STATE_LABELS: Record<FabRunState, string> = {
  running: 'Running',
  paused: 'Paused',
  complete: 'Complete',
}
