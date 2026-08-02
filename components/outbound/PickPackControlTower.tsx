import KpiTile from '@/components/kpi/KpiTile'
import LineCharts from '@/components/charts/LineCharts'
import BarChart from '@/components/charts/BarChart'
import { buildStationWorkload, buildTaskFlowTrend, calculateOutboundFloorKpis } from '@/lib/calculations/outbound'
import { getOutboundFloorData } from '@/lib/queries/outbound'
import { getCrossFunctionalKpis } from '@/lib/queries/operations'
import type { InboundQueueState, PickTaskStatus } from '@/types/outbound'
import type { QaResult } from '@/types/qa'

function formatDate(value: string | null): string {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return '-'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function capLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function taskStatusBadge(status: PickTaskStatus): string {
  if (status === 'blocked') {
    return 'bg-rose-500/20 text-rose-200 border-rose-400/40'
  }
  if (status === 'picking') {
    return 'bg-orange-500/20 text-orange-200 border-orange-400/40'
  }
  if (status === 'queued') {
    return 'bg-amber-500/20 text-amber-200 border-amber-400/40'
  }
  if (status === 'packed') {
    return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
  }
  if (status === 'completed') {
    return 'bg-zinc-500/20 text-zinc-200 border-zinc-400/40'
  }

  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40'
}

function qaResultBadge(result: QaResult): string {
  if (result === 'fail') {
    return 'bg-rose-500/20 text-rose-200 border-rose-400/40'
  }
  if (result === 'pass') {
    return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
  }
  if (result === 'pending') {
    return 'bg-amber-500/20 text-amber-200 border-amber-400/40'
  }

  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40'
}

function queueStateBadge(state: InboundQueueState): string {
  if (state === 'blocked') {
    return 'bg-rose-500/20 text-rose-200 border-rose-400/40'
  }
  if (state === 'qa_pending') {
    return 'bg-amber-500/20 text-amber-200 border-amber-400/40'
  }
  if (state === 'released') {
    return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
  }

  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40'
}

export default async function PickPackControlTower() {
  const [data, crossKpis] = await Promise.all([
    getOutboundFloorData(),
    getCrossFunctionalKpis(),
  ])

  const kpis = calculateOutboundFloorKpis(data)
  const taskTrend = buildTaskFlowTrend(data.tasks, 12)
  const stationWorkload = buildStationWorkload(data.stations, 10)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Outbound</span>{' '}
          <span className="text-[var(--foreground)]">Dashboard</span>
        </h1>
        <p className="text-zinc-400">Order release, pick execution, station health, and outbound workload in one view.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <KpiTile title="Open Pick Tasks" value={kpis.openTasks} />
        <KpiTile title="Late Tasks" value={kpis.lateTasks} />
        <KpiTile title="Units Remaining" value={kpis.unitsRemaining} />
        <KpiTile title="Active Stations" value={kpis.activeStations} />
        <KpiTile title="Avg. Utilization" value={kpis.avgUtilization} suffix="%" />
        <KpiTile title="Inbound QA Pending" value={crossKpis.inboundQaPending} />
        <KpiTile title="Inbound QA Blocked" value={crossKpis.inboundQaBlocked} />
        <KpiTile title="Inventory Risk SKUs" value={crossKpis.inventoryRiskSkus} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LineCharts
          title="Task Trend"
          description="Open, completed, and blocked pick activity over the last 12 days."
          labels={taskTrend.labels}
          series={[
            { name: 'Open', color: '#F07E1E', values: taskTrend.open },
            { name: 'Completed', color: '#6EE7B7', values: taskTrend.completed },
            { name: 'Blocked', color: '#F43F5E', values: taskTrend.blocked },
          ]}
        />

        <BarChart
          title="Station Snapshot"
          description="Top stations by utilization and queue depth."
          labels={stationWorkload.labels}
          series={[
            { name: 'Utilization %', color: '#F07E1E', values: stationWorkload.utilization },
            { name: 'Queue Depth', color: '#A78BFA', values: stationWorkload.queueDepth },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Open Picks</h2>
          <p className="mt-1 text-sm text-zinc-400">Open Pick Work</p>

          {data.tasks.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No rows found in `pick_tasks`.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-zinc-300">
                    <th className="px-3 py-2 font-semibold">Task</th>
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 font-semibold">Zone</th>
                    <th className="px-3 py-2 font-semibold">Station</th>
                    <th className="px-3 py-2 font-semibold">Remaining</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.slice(0, 20).map((task) => (
                    <tr key={task.id} className="border-b border-white/5 text-zinc-200 hover:bg-white/5">
                      <td className="px-3 py-2">{task.taskNumber}</td>
                      <td className="px-3 py-2">{task.sku}</td>
                      <td className="px-3 py-2">{task.zone}</td>
                      <td className="px-3 py-2">{task.assignedStation ?? '-'}</td>
                      <td className="px-3 py-2">{task.remainingQty}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${taskStatusBadge(task.status)}`}>
                          {capLabel(task.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Inbound / QA Queue</h2>
          <p className="mt-1 text-sm text-zinc-400">Shipments Pending Receipt</p>

          {data.inboundQaQueue.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No joined inbound/QA queue rows found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-zinc-300">
                    <th className="px-3 py-2 font-semibold">Shipment</th>
                    <th className="px-3 py-2 font-semibold">Supplier</th>
                    <th className="px-3 py-2 font-semibold">SKU</th>
                    <th className="px-3 py-2 font-semibold">ETA</th>
                    <th className="px-3 py-2 font-semibold">QA</th>
                    <th className="px-3 py-2 font-semibold">Queue State</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inboundQaQueue.slice(0, 20).map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 text-zinc-200 hover:bg-white/5">
                      <td className="px-3 py-2">{entry.shipmentId}</td>
                      <td className="px-3 py-2">{entry.supplier}</td>
                      <td className="px-3 py-2">{entry.productId}</td>
                      <td className="px-3 py-2">{formatDate(entry.eta)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${qaResultBadge(entry.qaResult)}`}>
                          {capLabel(entry.qaResult)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${queueStateBadge(entry.queueState)}`}>
                          {capLabel(entry.queueState)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
