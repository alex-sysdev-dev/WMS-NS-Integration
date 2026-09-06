import Link from 'next/link'
import { FAB_TEAM_ROLE_LABELS, type FabTeamMemberSummary } from '@/types/fab-team'
import { formatDuration, formatTact } from '@/lib/calculations/fabrication'

type Props = {
  summaries: FabTeamMemberSummary[]
}

function roleTone(role: FabTeamMemberSummary['member']['role']): string {
  if (role === 'fabrication_manager') {
    return 'border-orange-400/40 bg-orange-500/15 text-orange-100'
  }
  if (role === 'quality_control') {
    return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
  }
  return 'border-zinc-500/50 bg-zinc-700/30 text-zinc-100'
}

/**
 * A value the app cannot yet know renders as "Not connected", never as 0 or
 * "0.0". A zero here would be a claim about the floor, and the app is not in a
 * position to make it.
 */
function pending(label = 'Not connected') {
  return <span className="text-zinc-600">{label}</span>
}

export default function FabTeamTable({ summaries }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-zinc-300">
            <th className="px-4 py-3 font-semibold">Member</th>
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Reports To</th>
            <th className="px-4 py-3 font-semibold">Builds</th>
            <th className="px-4 py-3 font-semibold">Units</th>
            <th className="px-4 py-3 font-semibold">Avg Tact</th>
            <th className="px-4 py-3 font-semibold">Hands-On</th>
            <th className="px-4 py-3 font-semibold">Quality</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(({ member, manager, throughput, quality }) => (
            <tr key={member.id} className="border-b border-white/5 align-top text-zinc-200 hover:bg-white/5">
              <td className="px-4 py-3">
                <Link href={`/fab-team/${member.id}`} className="font-medium text-zinc-100 hover:text-orange-300">
                  {member.fullName}
                </Link>
                {member.employmentType === 'temp' && (
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">Temp</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleTone(member.role)}`}>
                  {FAB_TEAM_ROLE_LABELS[member.role]}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-300">
                {manager ? manager.fullName : <span className="text-zinc-500">Fab lead</span>}
              </td>
              <td className="px-4 py-3">{throughput.runsCompleted}</td>
              <td className="px-4 py-3">{throughput.unitsComplete}</td>
              <td className="px-4 py-3">
                {throughput.avgTactMs === null ? pending('No units logged') : formatTact(throughput.avgTactMs)}
              </td>
              <td className="px-4 py-3">
                {throughput.activeMs > 0 ? formatDuration(throughput.activeMs) : pending('No runs logged')}
              </td>
              <td className="px-4 py-3">
                {quality.attribution === null ? pending() : `${quality.passRate?.toFixed(1) ?? '0.0'}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
