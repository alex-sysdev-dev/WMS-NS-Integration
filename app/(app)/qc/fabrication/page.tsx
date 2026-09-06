import DataSourceNotice from '@/components/common/DataSourceNotice'
import KpiTile from '@/components/kpi/KpiTile'
import { FAB_TEAM } from '@/lib/fab-team'
import { getFabRequestQuality } from '@/lib/queries/fab-team'
import { FAB_FAILURE_CODES } from '@/types/fab-team'

export const dynamic = 'force-dynamic'

export default async function FabricationQcPage() {
  const inspections = await getFabRequestQuality()
  const inspector = FAB_TEAM.find((member) => member.role === 'quality_control') ?? null

  const qtyInspected = inspections.reduce((total, row) => total + row.qtyInspected, 0)
  const qtyFailed = inspections.reduce((total, row) => total + row.qtyFailed, 0)
  const reworkCount = inspections.filter((row) => row.reworkDone).length
  const passRate = qtyInspected > 0 ? ((qtyInspected - qtyFailed) / qtyInspected) * 100 : null

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
          {inspector ? ` Owned by ${inspector.fullName}.` : ''}
        </p>
      </header>

      <DataSourceNotice
        source="NetSuite fabrication QC records, one per work order"
        detail="Starting from zero. No inspection history is carried over from the retired tracking spreadsheets, and nothing is read from Supabase."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Inspections" value={inspections.length} />
        <KpiTile title="Qty Inspected" value={qtyInspected} />
        <KpiTile title="Qty Failed" value={qtyFailed} />
        <KpiTile title="Rework Logged" value={reworkCount} />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Inspection Log</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Every inspection, pass or fail, against the fab request it belongs to.
          {passRate !== null ? ` Current pass rate ${passRate.toFixed(1)}%.` : ''}
        </p>

        {inspections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/35 p-6 text-sm text-zinc-400">
            No inspections recorded yet. This fills in from the first inspection logged against a
            NetSuite work order.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Failure Codes</h2>
        <p className="mb-4 text-sm text-zinc-400">
          The codes an inspection can carry. Kept short on purpose, because a code list nobody can
          remember gets logged as &ldquo;Other&rdquo;.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(FAB_FAILURE_CODES).map(([code, label]) => (
            <div key={code} className="rounded-xl border border-zinc-700/60 bg-zinc-900/45 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-100">{code}</div>
              <div className="mt-0.5 text-xs text-zinc-400">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
