import DataSourceNotice from '@/components/common/DataSourceNotice'
import KpiTile from '@/components/kpi/KpiTile'
import FabTeamTable from '@/components/fab-team/FabTeamTable'
import { getFabRequestQuality, getFabTeamSummaries } from '@/lib/queries/fab-team'
import { FAB_TEAM_ROLE_LABELS } from '@/types/fab-team'

export const dynamic = 'force-dynamic'

export default async function FabTeamPage() {
  const [summaries, requestQuality] = await Promise.all([
    getFabTeamSummaries(),
    getFabRequestQuality(),
  ])

  const associates = summaries.filter((s) => s.member.role === 'fabrication_associate')
  const unitsLogged = summaries.reduce((total, s) => total + s.throughput.unitsComplete, 0)
  const buildsLogged = summaries.reduce((total, s) => total + s.throughput.runsCompleted, 0)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Fab</span>{' '}
          <span className="text-[var(--foreground)]">Team</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Who is on the fabrication floor, who they report to, and what each build actually costs in
          hands-on time. Throughput comes from logged fab runs. Quality is rebuilt from zero against
          NetSuite and reports nothing until fabrication is integrated.
        </p>
      </header>

      <DataSourceNotice
        source="NetSuite work orders for build demand, and station time entries for labor"
        detail="Throughput fills in as the bench logs runs. Quality stays blank until fabrication QC is integrated, since a defect has to attach to a work order that does not exist yet."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Team Members" value={summaries.length} />
        <KpiTile title="Associates" value={associates.length} />
        <KpiTile title="Builds Logged" value={buildsLogged} />
        <KpiTile title="Units Logged" value={unitsLogged} />
      </div>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Roster</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Reporting lines, throughput, and quality per member. A metric with no source reads as
          &ldquo;Not connected&rdquo; rather than zero.
        </p>
        <FabTeamTable summaries={summaries} />
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Quality by Fab Request</h2>
            <p className="mt-1 text-sm text-zinc-400">
              One inspection per request: quantity inspected, passed, failed, and the failure codes
              behind it.
            </p>
          </div>
        </div>

        {requestQuality.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/35 p-6 text-sm text-zinc-400">
            No inspections recorded. Fabrication quality starts fresh in NetSuite, so this fills in
            from the first inspection logged against a work order, not from the retired
            spreadsheets.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">Reporting Structure</h2>
        <p className="mb-5 text-sm text-zinc-400">
          Each role lands on a different surface at sign-in.
        </p>

        <div className="space-y-3">
          {summaries.map(({ member, manager }) => (
            <div
              key={member.id}
              className="flex flex-col gap-1 rounded-xl border border-zinc-700/60 bg-zinc-900/45 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-zinc-100">{member.fullName}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{FAB_TEAM_ROLE_LABELS[member.role]}</div>
              </div>
              <div className="text-xs text-zinc-400">
                {manager ? (
                  <>
                    Reports to <span className="font-medium text-zinc-200">{manager.fullName}</span>
                  </>
                ) : (
                  'Top of the fabrication org'
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
