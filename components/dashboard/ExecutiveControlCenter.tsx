import DataSourceNotice from '@/components/common/DataSourceNotice'
import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import { getProjectsNeedingAttention, getWarehouseKpis } from '@/lib/queries/warehouse'
import type { ProjectAttentionRow } from '@/types/warehouse'

/**
 * Timestamps and numbers are formatted with an explicit locale and time zone.
 *
 * Without them, `toLocaleString()` resolves against the *runtime's* locale and
 * zone, which differs between the Node server and the browser — the server
 * renders one string, the client renders another, and React reports a hydration
 * mismatch. LED Connection operates in Las Vegas, so Pacific is also the
 * correct zone to show a warehouse floor.
 */
const LOCALE = 'en-US'
const TIME_ZONE = 'America/Los_Angeles'

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return 'No sync yet'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })
}

/** Null means "not measured", which must not be rendered as a zero. */
function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Pending' : value.toLocaleString(LOCALE)
}

export default async function ExecutiveControlCenter() {
  const [kpis, attention] = await Promise.all([getWarehouseKpis(), getProjectsNeedingAttention()])

  const connected = kpis.snapshotAt !== null

  const pipelineTiles = [
    { title: 'Material Received', value: formatCount(kpis.projectsMaterialReceived) },
    { title: 'In Fabrication', value: formatCount(kpis.projectsInFabrication), accent: 'text-orange-100 group-hover:text-orange-50' },
    { title: 'Ready to Ship', value: formatCount(kpis.projectsReadyToShip), accent: 'text-emerald-100 group-hover:text-emerald-50' },
    { title: 'Partially Shipped', value: formatCount(kpis.projectsPartiallyShipped), accent: 'text-amber-100 group-hover:text-amber-50' },
  ]

  const flowTiles = [
    { title: 'Open Purchase Orders', value: formatCount(kpis.openPurchaseOrders) },
    { title: 'Projects Short Material', value: formatCount(kpis.projectsShortMaterial), accent: 'text-rose-100 group-hover:text-rose-50' },
    { title: 'Shipped This Week', value: formatCount(kpis.shipmentsThisWeek), accent: 'text-emerald-100 group-hover:text-emerald-50' },
    { title: 'Shipped This Month', value: formatCount(kpis.shipmentsThisMonth), accent: 'text-emerald-100 group-hover:text-emerald-50' },
  ]

  const qualityTiles = [
    { title: 'Open Fab Requests', value: formatCount(kpis.openFabRequests), accent: 'text-orange-100 group-hover:text-orange-50' },
    { title: 'Fab QC Holds', value: formatCount(kpis.fabQcHolds), accent: 'text-rose-100 group-hover:text-rose-50' },
    { title: 'Bins Never Counted', value: formatCount(kpis.binsNeverCounted), accent: 'text-amber-100 group-hover:text-amber-50' },
    { title: 'Open Variances', value: formatCount(kpis.openInventoryVariances), accent: 'text-rose-100 group-hover:text-rose-50' },
  ]

  const attentionColumns: Column<ProjectAttentionRow>[] = [
    { header: 'Project', accessor: 'projectNumber' },
    { header: 'Name', accessor: 'projectName' },
    { header: 'Customer', accessor: 'customer' },
    { header: 'Stage', accessor: 'stage' },
    { header: 'Needs Attention', accessor: 'reason' },
    { header: 'Install Date', accessor: 'installDate' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-orange-500">LED Connection</span>{' '}
            <span className="text-[var(--foreground)]">Warehouse Overview</span>
          </h1>
          <p className="mt-2 text-zinc-400">
            Project pipeline, material flow, and fabrication status for Headquarters.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-700/70 bg-[linear-gradient(150deg,rgba(3,7,18,0.92),rgba(15,23,42,0.84))] px-5 py-4 text-sm text-zinc-300">
          <div className="text-zinc-400">Last NetSuite sync</div>
          <div className="mt-1 font-semibold text-zinc-100">{formatTimestamp(kpis.snapshotAt)}</div>
        </div>
      </header>

      {!connected && (
        <DataSourceNotice
          source="NetSuite job stages, purchase orders, and item fulfillments"
          detail="Pipeline and shipping counts stay blank until the NetSuite sync is built. Fabrication and variance counts have no NetSuite source at all and will come from this system's own records."
        />
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Project pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {pipelineTiles.map((tile) => (
            <KpiTile key={tile.title} title={tile.title} value={tile.value} accent={tile.accent} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Material &amp; shipping
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {flowTiles.map((tile) => (
            <KpiTile key={tile.title} title={tile.title} value={tile.value} accent={tile.accent} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Fabrication &amp; inventory quality
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {qualityTiles.map((tile) => (
            <KpiTile key={tile.title} title={tile.title} value={tile.value} accent={tile.accent} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[linear-gradient(150deg,rgba(3,7,18,0.95),rgba(15,23,42,0.88))] p-6">
        <h2 className="text-xl font-semibold text-zinc-100">Projects needing attention</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Projects blocked on missing material, fabrication, or a quality hold.
        </p>

        <div className="mt-5 overflow-x-auto">
          <DataTable<ProjectAttentionRow>
            columns={attentionColumns}
            data={attention}
            emptyMessage="No projects flagged. Connect NetSuite to populate this list."
          />
        </div>
      </section>
    </div>
  )
}
