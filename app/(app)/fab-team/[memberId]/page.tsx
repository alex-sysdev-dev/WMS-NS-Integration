import Link from 'next/link'
import { notFound } from 'next/navigation'
import DataSourceNotice from '@/components/common/DataSourceNotice'
import KpiTile from '@/components/kpi/KpiTile'
import { getDirectReports, canUseMicrosoftSignIn } from '@/lib/fab-team'
import { getFabTeamSummary } from '@/lib/queries/fab-team'
import { formatDuration, formatTact } from '@/lib/calculations/fabrication'
import { FAB_SURFACE_BY_ROLE, FAB_TEAM_ROLE_LABELS } from '@/types/fab-team'

export const dynamic = 'force-dynamic'

const SURFACE_LABELS = {
  station: 'Station view (build documents and the timer, nothing else)',
  qc: 'QC dashboard',
  manager: 'Manager dashboard',
} as const

export default async function FabTeamMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const summary = await getFabTeamSummary(memberId)

  if (!summary) {
    notFound()
  }

  const { member, manager, throughput, quality } = summary
  const reports = getDirectReports(member.id)
  const surface = FAB_SURFACE_BY_ROLE[member.role]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <Link href="/fab-team" className="text-sm text-zinc-500 transition-colors hover:text-orange-300">
          Fab Team
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {member.fullName}
        </h1>
        <p className="text-zinc-400">
          {FAB_TEAM_ROLE_LABELS[member.role]}
          {manager ? ` · reports to ${manager.fullName}` : ' · top of the fabrication org'}
        </p>
      </header>

      <DataSourceNotice
        source="station time entries for throughput, and NetSuite fabrication QC for quality"
        detail="Throughput reflects runs actually logged. Quality reports nothing until fabrication QC is integrated."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Builds Completed" value={throughput.runsCompleted} />
        <KpiTile title="Units Complete" value={throughput.unitsComplete} />
        <KpiTile
          title="Avg Tact"
          value={throughput.avgTactMs === null ? 'No units' : formatTact(throughput.avgTactMs)}
        />
        <KpiTile
          title="Hands-On Time"
          value={throughput.activeMs > 0 ? formatDuration(throughput.activeMs) : 'None logged'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Quality</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Inspection results attributed to this member.
          </p>

          {quality.attribution === null ? (
            <div className="mt-5 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/35 p-4 text-sm text-zinc-400">
              No inspections recorded. Note that a build is done by a crew, so an inspection covers a
              crew. Once QC is live, a defect only counts against one person when the inspector
              attributes it to them.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-zinc-300">
              <div>
                <div className="text-zinc-500">Inspected</div>
                <div className="mt-1 font-semibold text-zinc-100">{quality.qtyInspected}</div>
              </div>
              <div>
                <div className="text-zinc-500">Failed</div>
                <div className="mt-1 font-semibold text-zinc-100">{quality.qtyFailed}</div>
              </div>
              <div>
                <div className="text-zinc-500">Pass Rate</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {quality.passRate?.toFixed(1) ?? 'Pending'}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Attribution</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {quality.attribution === 'crew' ? 'Crew, not individual' : 'Individual'}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Access</h2>
          <p className="mt-1 text-sm text-zinc-400">Which surface this member signs in to.</p>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Surface</dt>
              <dd className="text-right text-zinc-200">{SURFACE_LABELS[surface]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Employment</dt>
              <dd className="text-zinc-200">{member.employmentType === 'temp' ? 'Temp' : 'Staff'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Microsoft sign-in</dt>
              <dd className="text-zinc-200">
                {canUseMicrosoftSignIn(member) ? 'Eligible' : 'Not available, needs badge scan'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">NetSuite employee</dt>
              <dd className="text-zinc-200">{member.netsuiteId ?? 'Not linked yet'}</dd>
            </div>
          </dl>

          {reports.length > 0 && (
            <div className="mt-6 border-t border-zinc-800 pt-5">
              <div className="text-sm font-medium text-zinc-300">Direct reports</div>
              <ul className="mt-3 space-y-2">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Link
                      href={`/fab-team/${report.id}`}
                      className="text-sm text-zinc-400 transition-colors hover:text-orange-300"
                    >
                      {report.fullName}
                      <span className="text-zinc-600"> · {FAB_TEAM_ROLE_LABELS[report.role]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
