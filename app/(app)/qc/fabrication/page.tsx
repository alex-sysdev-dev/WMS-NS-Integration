import KpiTile from '@/components/kpi/KpiTile'
import DataTable, { type Column } from '@/components/tables/DataTable'
import DataSourceNotice from '@/components/common/DataSourceNotice'
import { calculateFabricationQcKpis, getFabricationInspections } from '@/lib/queries/qc'
import type { FabricationInspection } from '@/types/qc'

export const dynamic = 'force-dynamic'

export default async function FabricationQcPage() {
  const inspections = await getFabricationInspections()
  const kpis = calculateFabricationQcKpis(inspections)

  const columns: Column<FabricationInspection>[] = [
    { header: 'Request', accessor: 'requestNumber' },
    { header: 'Project', accessor: 'projectNumber' },
    { header: 'Inspector', accessor: 'inspector' },
    { header: 'Result', accessor: 'result' },
    { header: 'Defects', accessor: 'defectCount' },
    { header: 'Inspected At', accessor: 'inspectedAt' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Fabrication</span>{' '}
          <span className="text-[var(--foreground)]">QC</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Inspection of finished builds before they are released to ship. A defect caught here is a
          rework on the bench; the same defect caught after delivery is a site visit to a venue.
        </p>
      </header>

      <DataSourceNotice
        source="WMS-owned inspection records, one per fabrication build"
        detail="Depends on the fabrication queue being connected first, since an inspection attaches to a build."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <KpiTile title="Awaiting Inspection" value={kpis.awaitingInspection} />
        <KpiTile title="Passed" value={kpis.passed} />
        <KpiTile title="Failed" value={kpis.failed} />
        <KpiTile title="Rework Open" value={kpis.reworkOpen} />
        <KpiTile title="Pass Rate" value={kpis.passRate} suffix="%" />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Inspection Log</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Every inspection, pass or fail, against the build and project it belongs to.
        </p>
        <div className="overflow-x-auto">
          <DataTable<FabricationInspection>
            columns={columns}
            data={inspections}
            emptyMessage="No inspections recorded yet."
          />
        </div>
      </section>
    </div>
  )
}
