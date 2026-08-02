import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import DataSourceNotice from '@/components/common/DataSourceNotice'
import {
  calculateFabricationKpis,
  getFabricationComponents,
  getFabricationRequests,
} from '@/lib/queries/fabrication'
import type { FabricationComponent, FabricationRequest } from '@/types/fabrication'

export const dynamic = 'force-dynamic'

export default async function FabricationPage() {
  const [requests, components] = await Promise.all([
    getFabricationRequests(),
    getFabricationComponents(),
  ])
  const kpis = calculateFabricationKpis(requests, components)

  const requestColumns: Column<FabricationRequest>[] = [
    { header: 'Request', accessor: 'requestNumber' },
    { header: 'Project', accessor: 'projectNumber' },
    { header: 'Description', accessor: 'description' },
    { header: 'Fab Bin', accessor: 'fabBin' },
    { header: 'Status', accessor: 'status' },
    { header: 'Assigned To', accessor: 'assignedTo' },
    { header: 'Due', accessor: 'dueAt' },
  ]

  const componentColumns: Column<FabricationComponent>[] = [
    { header: 'Request', accessor: 'requestNumber' },
    { header: 'Item', accessor: 'itemName' },
    { header: 'Lot', accessor: 'lotNumber' },
    { header: 'Bin', accessor: 'binNumber' },
    { header: 'Required', accessor: 'requiredQty' },
    { header: 'Staged', accessor: 'stagedQty' },
    { header: 'Short', accessor: 'shortQty' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Fabrication</span>{' '}
          <span className="text-[var(--foreground)]">Queue</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Build requests by project, the raw components each one consumes, and what is short.
          Fabrication is tracked here rather than in NetSuite, which has no work order or assembly
          build records.
        </p>
      </header>

      <DataSourceNotice
        source="WMS-owned fabrication records keyed on the NetSuite project number"
        detail="Fabrication has no home in NetSuite today, so this queue needs its own store before it can show live builds."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <KpiTile title="Open Requests" value={kpis.openRequests} />
        <KpiTile title="Queued" value={kpis.queued} />
        <KpiTile title="In Progress" value={kpis.inProgress} />
        <KpiTile title="On QC Hold" value={kpis.qcHold} />
        <KpiTile title="Short Components" value={kpis.shortComponents} />
        <KpiTile title="Completed This Month" value={kpis.completedThisMonth} />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Build Requests</h2>
        <p className="mb-4 text-sm text-zinc-400">
          One row per requested build, keyed on the project it belongs to.
        </p>
        <div className="overflow-x-auto">
          <DataTable<FabricationRequest>
            columns={requestColumns}
            data={requests}
            emptyMessage="No fabrication requests yet. This table fills in once the fabrication store is connected."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Component Staging</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Raw parts each build needs. Every line carries a lot number, because inventory here is
          lot-tracked and never serialized — one requirement can draw from more than one lot.
        </p>
        <div className="overflow-x-auto">
          <DataTable<FabricationComponent>
            columns={componentColumns}
            data={components}
            emptyMessage="No component requirements yet."
          />
        </div>
      </section>
    </div>
  )
}
