import InterimStoreNotice from '@/components/fabrication/InterimStoreNotice'
import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import {
  calculateTactKpis,
  formatDuration,
  RUN_STATE_LABELS,
  runActiveMs,
  runElapsedMs,
  runTactMs,
  stepTotals,
} from '@/lib/calculations/fabrication'
import { snapshotRuns } from '@/lib/queries/fab-runs'
import type { FabRun } from '@/types/fabrication'

export const dynamic = 'force-dynamic'

/**
 * The leadership view. Read only, on purpose.
 *
 * Nothing here can start, stop, or edit a run. Time is recorded at the bench by
 * the person doing the work, and a page that let someone else adjust it after
 * the fact would make every number on it arguable.
 *
 * Durations for runs still in progress are measured as of page load rather than
 * ticking. A live clock on a review page invites watching rather than reading,
 * and the load time is stated so a stale figure is never mistaken for current.
 */

type RunRow = {
  day: string
  project: string
  build: string
  bin: string
  operator: string
  handsOn: string
  wallClock: string
  units: string
  tact: string
  status: string
}

function toRow(run: FabRun, nowMs: number): RunRow {
  const active = runActiveMs(run, nowMs)
  const tact = runTactMs(run, nowMs)

  return {
    day: new Date(run.startedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    project: run.projectNumber,
    build: run.description,
    bin: run.fabBin ?? 'not set',
    operator: run.operator,
    handsOn: formatDuration(active),
    wallClock: formatDuration(runElapsedMs(run, nowMs)),
    units: run.targetUnits > 0 ? run.unitsComplete + ' / ' + run.targetUnits : String(run.unitsComplete),
    tact: tact === null ? 'no units' : formatDuration(tact),
    status: RUN_STATE_LABELS[run.state],
  }
}

export default async function FabricationTactPage() {
  const { runs, readAtMs: nowMs } = await snapshotRuns()
  const kpis = calculateTactKpis(runs, nowMs)
  const steps = stepTotals(runs, nowMs)
  const rows = runs.map((run) => toRow(run, nowMs))

  const columns: Column<RunRow>[] = [
    { header: 'Started', accessor: 'day' },
    { header: 'Project', accessor: 'project' },
    { header: 'Build', accessor: 'build' },
    { header: 'Bin', accessor: 'bin' },
    { header: 'Operator', accessor: 'operator' },
    { header: 'Hands-on', accessor: 'handsOn' },
    { header: 'Wall clock', accessor: 'wallClock' },
    { header: 'Units', accessor: 'units' },
    { header: 'Tact / unit', accessor: 'tact' },
    { header: 'Status', accessor: 'status' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Tact</span>{' '}
          <span className="text-[var(--foreground)]">Time</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Every fabrication run the floor has logged, the hands-on hours behind it, and the time per
          unit produced. Hands-on time excludes pauses. Wall clock does not, so the gap between the
          two columns is how long a build sat waiting on something.
        </p>
      </header>

      <InterimStoreNotice />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <KpiTile title="Clocks Running Now" value={kpis.activeRuns} />
        <KpiTile title="Open Builds" value={kpis.openRuns} />
        <KpiTile title="Finished Today" value={kpis.runsCompletedToday} />
        <KpiTile title="Units Finished Today" value={kpis.unitsToday} />
        <KpiTile title="Hands-On Hours Today" value={kpis.activeHoursToday} suffix=" h" />
        <KpiTile
          title="Avg Tact / Unit"
          value={kpis.avgTactMs === null ? 'no units yet' : formatDuration(kpis.avgTactMs)}
        />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Where The Time Goes</h2>
        <p className="mb-5 text-sm text-zinc-400">
          Hands-on time by step across every run. This is the number that tells you which part of a
          build to attack (a single figure for how long a build takes never will).
        </p>

        {steps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 px-5 py-8 text-center text-sm text-zinc-500">
            No time logged yet. Step totals appear as soon as the first run is started on the Fab
            Floor page.
          </p>
        ) : (
          <ul className="space-y-3">
            {steps.map((step) => (
              <li key={step.step}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-zinc-200">{step.step}</span>
                  <span className="tabular text-zinc-400">
                    {formatDuration(step.totalMs)} across {step.runCount}{' '}
                    {step.runCount === 1 ? 'build' : 'builds'} ({Math.round(step.share * 100)}%)
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: Math.max(1, Math.round(step.share * 100)) + '%' }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Run Log</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Newest first. Durations for open builds are measured as of{' '}
          {new Date(nowMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, when
          this page loaded. Reload for current figures.
        </p>
        <div className="overflow-x-auto">
          <DataTable<RunRow>
            columns={columns}
            data={rows}
            emptyMessage="No runs logged yet. The first one shows up here the moment the floor taps start."
          />
        </div>
      </section>
    </div>
  )
}
