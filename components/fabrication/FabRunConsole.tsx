'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  formatClock,
  formatDuration,
  formatTact,
  openSegment,
  runActiveMs,
  runProgress,
  runTactMs,
  segmentMs,
} from '@/lib/calculations/fabrication'
import { FAB_STEPS, type FabRun, type ProjectLookupResult } from '@/types/fabrication'

/**
 * The bench console.
 *
 * Design rules this follows, all of them driven by where it gets used, which is
 * standing at a workbench with a tablet and possibly gloves on:
 *
 *   - One clock, large enough to read from a step back, and one primary button.
 *     Everything else is smaller and further down.
 *   - Touch targets are at least 56px tall. A 32px button is a mis-tap.
 *   - The clock ticks locally every second but is anchored to the server clock,
 *     so a tablet with a wrong system time still logs correct durations.
 *   - Stop takes two taps. Losing a run to a brushed sleeve is worse than the
 *     extra tap.
 *   - Every write is confirmed by the server's own copy of the run coming back.
 *     Nothing on this screen is optimistic, because a timer that shows a state
 *     the server did not accept is worse than a half second of lag.
 */

const POLL_MS = 20_000

type Props = {
  /** Runs already open when the page rendered, so the console is never blank. */
  initialRuns: FabRun[]
  initialServerNow: string
  /**
   * Fires when the operator switches to a different build, so the document
   * panel beside the console can follow along to that project's fab sheets.
   */
  onActiveProjectChange?: (projectNumber: string | null) => void
}

type StartForm = {
  projectNumber: string
  description: string
  fabBin: string
  targetUnits: string
  step: string
}

const EMPTY_FORM: StartForm = {
  projectNumber: '',
  description: '',
  fabBin: '',
  targetUnits: '',
  step: FAB_STEPS[0],
}

/**
 * Lookup state for the project number field.
 *
 * 'idle' covers both "nothing typed" and "not looked up yet". Everything else
 * mirrors the API, and 'not_connected' is kept distinct from 'not_found' all
 * the way to the screen: a lookup that could not run must never read as a
 * project that does not exist.
 */
type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'not_found'; projectNumber: string }
  | { status: 'found'; projectName: string; customer: string | null; dueAt: string | null }

export default function FabRunConsole({
  initialRuns,
  initialServerNow,
  onActiveProjectChange,
}: Props) {
  const [runs, setRuns] = useState<FabRun[]>(initialRuns)
  const [selectedId, setSelectedId] = useState<string | null>(initialRuns[0]?.id ?? null)
  const [form, setForm] = useState<StartForm>(EMPTY_FORM)
  const [showStart, setShowStart] = useState(initialRuns.length === 0)
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [tick, setTick] = useState(() => Date.now())

  /**
   * Offset between this device's clock and the server's. Durations are computed
   * from server-stamped timestamps, so mixing in an uncorrected local Date.now()
   * would show a negative or wildly inflated elapsed time on a tablet whose
   * clock has drifted.
   */
  const offsetRef = useRef<number>(Date.parse(initialServerNow) - Date.now())
  const nowMs = tick + offsetRef.current

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const applyPayload = useCallback((serverNow: string | undefined) => {
    if (serverNow) {
      const parsed = Date.parse(serverNow)
      if (Number.isFinite(parsed)) {
        offsetRef.current = parsed - Date.now()
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/fabrication/runs?scope=open', { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const payload = (await response.json()) as { runs: FabRun[]; serverNow: string }
      applyPayload(payload.serverNow)
      setRuns(payload.runs)
    } catch {
      // A failed poll is not worth an error banner. The next one is 20s away and
      // the on-screen clock is still correct, because it runs off the last run
      // payload rather than off the poll.
    }
  }, [applyPayload])

  // Picks up a run another bench started or stopped on a different device.
  useEffect(() => {
    const id = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!confirmStop) {
      return
    }
    const id = window.setTimeout(() => setConfirmStop(false), 6000)
    return () => window.clearTimeout(id)
  }, [confirmStop])

  const selected = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? runs[0] ?? null,
    [runs, selectedId]
  )

  const activeProject = selected?.projectNumber ?? null

  useEffect(() => {
    onActiveProjectChange?.(activeProject)
  }, [activeProject, onActiveProjectChange])

  const mutate = useCallback(
    async (body: Record<string, unknown>) => {
      if (!selected) {
        return
      }
      setPending(true)
      setError(null)
      try {
        const response = await fetch('/api/fabrication/runs/' + selected.id, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = (await response.json()) as {
          run?: FabRun
          message?: string
          serverNow?: string
        }
        if (!response.ok || !payload.run) {
          setError(payload.message ?? 'That did not save. The run is unchanged.')
          return
        }
        applyPayload(payload.serverNow)
        const saved = payload.run
        setRuns((current) => {
          // A stopped run leaves the console, since this view is open runs only.
          if (saved.state === 'complete') {
            return current.filter((run) => run.id !== saved.id)
          }
          return current.map((run) => (run.id === saved.id ? saved : run))
        })
        if (saved.state === 'complete') {
          setSelectedId(null)
          setShowStart(true)
        }
      } catch {
        setError('Could not reach the server. Nothing was saved.')
      } finally {
        setPending(false)
      }
    },
    [applyPayload, selected]
  )

  /**
   * Resolves a typed project number and fills the rest of the form.
   *
   * Runs on blur and on Enter rather than on every keystroke: project numbers
   * are long enough that per-character lookups would fire a dozen useless
   * requests and flicker the status line while someone is mid-type.
   *
   * Only fills fields the operator has left empty. Overwriting something they
   * already typed, because a lookup came back late, is worse than not filling
   * it at all.
   */
  const runLookup = useCallback(async (projectNumber: string) => {
    const trimmed = projectNumber.trim()
    if (!trimmed) {
      setLookup({ status: 'idle' })
      return
    }

    setLookup({ status: 'loading' })

    try {
      const response = await fetch(
        `/api/fabrication/project-lookup?number=${encodeURIComponent(trimmed)}`
      )
      if (!response.ok) {
        setLookup({ status: 'not_connected' })
        return
      }

      const result = (await response.json()) as ProjectLookupResult

      if (result.state === 'not_connected') {
        setLookup({ status: 'not_connected' })
        return
      }

      if (result.state === 'not_found') {
        setLookup({ status: 'not_found', projectNumber: trimmed })
        return
      }

      const { project } = result
      setLookup({
        status: 'found',
        projectName: project.projectName,
        customer: project.customer,
        dueAt: project.dueAt,
      })

      const single = project.builds.length === 1 ? project.builds[0] : null

      setForm((current) => ({
        ...current,
        fabBin: current.fabBin || (project.fabBin ?? ''),
        description: current.description || (single?.description ?? ''),
        targetUnits:
          current.targetUnits || (single && single.targetUnits > 0 ? String(single.targetUnits) : ''),
      }))
    } catch {
      // A failed request is a connection problem, not a missing project.
      setLookup({ status: 'not_connected' })
    }
  }, [])

  const start = useCallback(async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/fabrication/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectNumber: form.projectNumber,
          description: form.description,
          fabBin: form.fabBin,
          targetUnits: form.targetUnits === '' ? 0 : Number(form.targetUnits),
          step: form.step,
        }),
      })
      const payload = (await response.json()) as {
        run?: FabRun
        message?: string
        serverNow?: string
      }
      if (!response.ok || !payload.run) {
        setError(payload.message ?? 'Could not start the run.')
        return
      }
      applyPayload(payload.serverNow)
      const started = payload.run
      setRuns((current) => [started, ...current])
      setSelectedId(started.id)
      setForm(EMPTY_FORM)
      setLookup({ status: 'idle' })
      setShowStart(false)
    } catch {
      setError('Could not reach the server. The run was not started.')
    } finally {
      setPending(false)
    }
  }, [applyPayload, form])

  const canStart =
    form.projectNumber.trim().length > 0 && form.description.trim().length > 0 && !pending

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/50 bg-red-500/10 px-5 py-4 text-sm text-red-100"
        >
          {error}
        </div>
      )}

      {runs.length > 1 && (
        <RunSwitcher
          runs={runs}
          selectedId={selected?.id ?? null}
          nowMs={nowMs}
          onSelect={(id) => {
            setSelectedId(id)
            setConfirmStop(false)
          }}
        />
      )}

      {selected && !showStart && (
        <ActiveRunCard
          run={selected}
          nowMs={nowMs}
          pending={pending}
          confirmStop={confirmStop}
          onPause={() => mutate({ action: 'pause' })}
          onResume={() => mutate({ action: 'resume' })}
          onSwitchStep={(step) => mutate({ action: 'switch_step', step })}
          onSetUnits={(units) => mutate({ action: 'set_units', unitsComplete: units })}
          onStop={() => {
            if (!confirmStop) {
              setConfirmStop(true)
              return
            }
            setConfirmStop(false)
            void mutate({ action: 'stop' })
          }}
          onCancelStop={() => setConfirmStop(false)}
        />
      )}

      {showStart ? (
        <StartCard
          form={form}
          pending={pending}
          canStart={canStart}
          canCancel={runs.length > 0}
          lookup={lookup}
          onChange={(patch) => {
            // Editing the number invalidates whatever the last lookup resolved.
            if (patch.projectNumber !== undefined) {
              setLookup({ status: 'idle' })
            }
            setForm((current) => ({ ...current, ...patch }))
          }}
          onLookup={() => void runLookup(form.projectNumber)}
          onStart={() => void start()}
          onCancel={() => setShowStart(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowStart(true)}
          className="min-h-14 w-full rounded-2xl border border-dashed border-zinc-700 px-6 text-base font-semibold text-zinc-300 transition hover:border-orange-500/60 hover:text-orange-200"
        >
          Start another build
        </button>
      )}
    </div>
  )
}

/* ---------------------------------- parts --------------------------------- */

function RunSwitcher({
  runs,
  selectedId,
  nowMs,
  onSelect,
}: {
  runs: FabRun[]
  selectedId: string | null
  nowMs: number
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {runs.map((run) => {
        const active = run.id === selectedId
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(run.id)}
            className={
              'min-h-14 flex-none rounded-xl border px-4 py-2 text-left transition ' +
              (active
                ? 'border-orange-500/70 bg-orange-500/10'
                : 'border-zinc-700 bg-[#151517] hover:border-zinc-600')
            }
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <StateDot state={run.state} />
              {run.projectNumber}
            </div>
            <div className="tabular text-xs text-zinc-400">
              {formatClock(runActiveMs(run, nowMs))}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function StateDot({ state }: { state: FabRun['state'] }) {
  const color =
    state === 'running' ? 'bg-emerald-400' : state === 'paused' ? 'bg-amber-400' : 'bg-zinc-500'
  return (
    <span
      aria-hidden="true"
      className={
        'h-2.5 w-2.5 flex-none rounded-full ' +
        color +
        (state === 'running' ? ' animate-pulse' : '')
      }
    />
  )
}

function ActiveRunCard({
  run,
  nowMs,
  pending,
  confirmStop,
  onPause,
  onResume,
  onSwitchStep,
  onSetUnits,
  onStop,
  onCancelStop,
}: {
  run: FabRun
  nowMs: number
  pending: boolean
  confirmStop: boolean
  onPause: () => void
  onResume: () => void
  onSwitchStep: (step: string) => void
  onSetUnits: (units: number) => void
  onStop: () => void
  onCancelStop: () => void
}) {
  const running = run.state === 'running'
  const current = openSegment(run)
  const activeMs = runActiveMs(run, nowMs)
  const tact = runTactMs(run, nowMs)
  const progress = runProgress(run)

  // Steps already logged on this run, so a step typed once stays one tap away.
  const steps = useMemo(() => {
    const seen = new Set<string>(FAB_STEPS)
    for (const segment of run.segments) {
      seen.add(segment.step)
    }
    return [...seen]
  }, [run.segments])

  return (
    <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <StateDot state={run.state} />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {running ? 'Clock running' : 'Paused'}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{run.description}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Project {run.projectNumber}
            {run.fabBin ? ' · Bin ' + run.fabBin : ''} · {run.operator}
          </p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          <div>
            Started{' '}
            {new Date(run.startedAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
          {current && <div className="text-zinc-500">On {current.step}</div>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <div
            className="tabular text-6xl font-bold leading-none tracking-tight text-zinc-50 sm:text-7xl"
            aria-live="off"
          >
            {formatClock(activeMs)}
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Hands-on time. Pauses are excluded, so this is the number tact time is built from.
          </p>
          {current && (
            <p className="tabular mt-1 text-sm text-zinc-500">
              {current.step} for {formatDuration(segmentMs(current, nowMs))}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={running ? onPause : onResume}
            disabled={pending}
            className={
              'min-h-20 min-w-56 rounded-2xl px-8 text-xl font-bold transition disabled:opacity-50 ' +
              (running
                ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400')
            }
          >
            {running ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            onClick={onStop}
            disabled={pending}
            className={
              'min-h-20 min-w-56 rounded-2xl px-8 text-xl font-bold transition disabled:opacity-50 ' +
              (confirmStop
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'border-2 border-red-500/60 text-red-200 hover:bg-red-500/10')
            }
          >
            {confirmStop ? 'Tap again to finish' : 'Finish build'}
          </button>

          {confirmStop && (
            <button
              type="button"
              onClick={onCancelStop}
              className="min-h-12 rounded-xl border border-zinc-700 px-6 text-sm font-semibold text-zinc-300 hover:border-zinc-600"
            >
              Keep working
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-white/5 pt-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Current step
        </div>
        <div className="flex flex-wrap gap-2.5">
          {steps.map((step) => {
            const isCurrent = current?.step === step
            return (
              <button
                key={step}
                type="button"
                onClick={() => onSwitchStep(step)}
                disabled={pending}
                className={
                  'min-h-14 rounded-xl border px-5 text-base font-semibold transition disabled:opacity-50 ' +
                  (isCurrent
                    ? 'border-orange-500 bg-orange-500/15 text-orange-100'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100')
                }
              >
                {step}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Switching steps does not stop the clock. It closes the current stretch and opens the next
          one, so the breakdown shows where the time went.
        </p>
      </div>

      <div className="mt-8 grid gap-6 border-t border-white/5 pt-6 sm:grid-cols-2">
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Units complete
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onSetUnits(Math.max(0, run.unitsComplete - 1))}
              disabled={pending || run.unitsComplete === 0}
              className="h-16 w-16 rounded-2xl border border-zinc-700 text-2xl font-bold text-zinc-200 transition hover:border-zinc-600 disabled:opacity-40"
              aria-label="One fewer unit complete"
            >
              &minus;
            </button>
            <div className="tabular min-w-24 text-center text-4xl font-bold text-zinc-50">
              {run.unitsComplete}
              {run.targetUnits > 0 && (
                <span className="text-xl font-semibold text-zinc-500">
                  {' / ' + run.targetUnits}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSetUnits(run.unitsComplete + 1)}
              disabled={pending}
              className="h-16 w-16 rounded-2xl bg-orange-500 text-2xl font-bold text-orange-950 transition hover:bg-orange-400 disabled:opacity-40"
              aria-label="One more unit complete"
            >
              +
            </button>
          </div>
          {progress !== null && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                style={{ width: Math.round(progress * 100) + '%' }}
              />
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Tact time so far
          </div>
          <div className="tabular text-3xl font-bold text-zinc-50">
            {tact === null ? 'n/a' : formatClock(tact)}
          </div>
          <p className="mt-2 text-sm text-zinc-400">{formatTact(tact)}</p>
        </div>
      </div>
    </section>
  )
}

function StartCard({
  form,
  pending,
  canStart,
  canCancel,
  lookup,
  onChange,
  onLookup,
  onStart,
  onCancel,
}: {
  form: StartForm
  pending: boolean
  canStart: boolean
  canCancel: boolean
  lookup: LookupState
  onChange: (patch: Partial<StartForm>) => void
  onLookup: () => void
  onStart: () => void
  onCancel: () => void
}) {
  const fieldClass =
    'min-h-14 w-full rounded-xl border border-zinc-700 bg-[#0F0F11] px-4 text-base text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none'

  return (
    <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-zinc-100">Start a build</h2>
      <p className="mb-6 mt-1 text-sm text-zinc-400">
        The project number is what ties this run back to the job in NetSuite, so it is the one
        field that is required alongside a description.
      </p>

      <form
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (canStart) {
            onStart()
          }
        }}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">Project number</span>
          <input
            className={fieldClass}
            value={form.projectNumber}
            onChange={(event) => onChange({ projectNumber: event.target.value })}
            /*
             * Blur and Enter both resolve. Enter matters beyond keyboard
             * convenience: a barcode scanner is a keyboard that types the value
             * and sends Enter, so if the scanner proposal is approved this field
             * already works with one and needs no separate mode.
             */
            onBlur={onLookup}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onLookup()
              }
            }}
            placeholder="e.g. KR-00495-UT"
            autoComplete="off"
            required
          />
          <LookupStatus lookup={lookup} />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">What is being built</span>
          <input
            className={fieldClass}
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="e.g. Luxor lobby cabinet frames"
            autoComplete="off"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Fab bin <span className="text-zinc-500">(optional)</span>
          </span>
          <input
            className={fieldClass}
            value={form.fabBin}
            onChange={(event) => onChange({ fabBin: event.target.value })}
            placeholder="FAB1 to FAB9"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Units expected <span className="text-zinc-500">(optional)</span>
          </span>
          <input
            className={fieldClass}
            value={form.targetUnits}
            onChange={(event) =>
              onChange({ targetUnits: event.target.value.replace(/[^0-9]/g, '') })
            }
            placeholder="e.g. 12"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>

        <div className="sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-zinc-300">Starting step</span>
          <div className="flex flex-wrap gap-2.5">
            {FAB_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => onChange({ step })}
                className={
                  'min-h-14 rounded-xl border px-5 text-base font-semibold transition ' +
                  (form.step === step
                    ? 'border-orange-500 bg-orange-500/15 text-orange-100'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-600')
                }
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
          <button
            type="submit"
            disabled={!canStart}
            className="min-h-20 flex-1 rounded-2xl bg-emerald-500 px-8 text-2xl font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Starting...' : 'Start clock'}
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-20 rounded-2xl border border-zinc-700 px-8 text-base font-semibold text-zinc-300 transition hover:border-zinc-600"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

/**
 * The one line under the project number that says what the lookup found.
 *
 * The distinction that matters here is between "could not ask NetSuite" and
 * "asked, and there is no such project". The first is amber and informational,
 * because nothing is wrong with what was typed. The second is red, because
 * something is: it is the mistyped-project-number case this lookup exists to
 * catch, and it is the difference between a run logged against KR-00495-UT and
 * one logged against a project that does not exist.
 *
 * Neither state blocks the start button. The bench should not be stopped from
 * logging real work because an integration is down, and a warning they can read
 * and act on does more good than a hard block they will find a way around.
 */
function LookupStatus({ lookup }: { lookup: LookupState }) {
  if (lookup.status === 'idle') {
    return null
  }

  const base = 'mt-2 block text-xs leading-relaxed'

  if (lookup.status === 'loading') {
    return <span className={`${base} text-zinc-500`}>Looking up project...</span>
  }

  if (lookup.status === 'not_connected') {
    return (
      <span className={`${base} text-amber-300/90`}>
        Not connected to NetSuite, so nothing could be filled in or checked. Type the rest by hand.
      </span>
    )
  }

  if (lookup.status === 'not_found') {
    return (
      <span className={`${base} text-rose-300`}>
        NetSuite has no project {lookup.projectNumber}. Check the number before starting.
      </span>
    )
  }

  const detail = [lookup.customer, lookup.dueAt ? `due ${lookup.dueAt}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <span className={`${base} text-emerald-300`}>
      {lookup.projectName}
      {detail ? <span className="text-emerald-300/70"> · {detail}</span> : null}
    </span>
  )
}
