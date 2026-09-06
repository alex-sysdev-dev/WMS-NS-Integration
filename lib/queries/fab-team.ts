import { FAB_TEAM, getFabTeamMember, getManagerFor } from '@/lib/fab-team'
import { listRuns } from '@/lib/queries/fab-runs'
import { runActiveMs } from '@/lib/calculations/fabrication'
import type {
  FabQualityMetrics,
  FabRequestQuality,
  FabTeamMember,
  FabTeamMemberSummary,
  FabThroughputMetrics,
} from '@/types/fab-team'

/**
 * Throughput comes from fab runs, quality does not come from anywhere yet.
 *
 * Runs are real: whatever the bench has actually logged is counted here and
 * nothing is filled in around it. A member with no runs gets zeroes and null
 * averages, which is the honest reading of "nobody has logged a build."
 *
 * Quality is a deliberate blank. Fabrication QC is being rebuilt from zero
 * against NetSuite, so there is no inspection source to read and this returns
 * an empty metric rather than a number nobody can defend.
 */

export const FAB_QUALITY_SOURCE_READY = false

const EMPTY_QUALITY: FabQualityMetrics = {
  inspections: 0,
  qtyInspected: 0,
  qtyPassed: 0,
  qtyFailed: 0,
  passRate: null,
  reworkCount: 0,
  attribution: null,
}

function emptyThroughput(): FabThroughputMetrics {
  return {
    runsCompleted: 0,
    unitsComplete: 0,
    activeMs: 0,
    avgTactMs: null,
    avgBuildMs: null,
  }
}

/**
 * Matches a logged run to a roster member.
 *
 * Runs record whoever was signed in, which today is a Supabase user id and a
 * display name, neither of which is a roster id. Until the station surface
 * attributes by badge scan, the only honest link is an exact, case-insensitive
 * name match. A run that cannot be matched is left out rather than assigned to
 * the nearest plausible person.
 */
function runBelongsTo(operatorId: string, operatorName: string, member: FabTeamMember): boolean {
  if (member.netsuiteId && operatorId === member.netsuiteId) {
    return true
  }

  if (member.authSubject && operatorId === member.authSubject) {
    return true
  }

  return operatorName.trim().toLowerCase() === member.fullName.toLowerCase()
}

export async function getThroughputByMember(): Promise<Map<string, FabThroughputMetrics>> {
  const runs = await listRuns()
  const now = Date.now()
  const byMember = new Map<string, FabThroughputMetrics>()

  for (const member of FAB_TEAM) {
    const mine = runs.filter((run) => runBelongsTo(run.operatorId, run.operator, member))
    const completed = mine.filter((run) => run.state === 'complete')
    const activeMs = mine.reduce((total, run) => total + runActiveMs(run, now), 0)
    const unitsComplete = mine.reduce((total, run) => total + run.unitsComplete, 0)

    const completedActiveMs = completed.reduce((total, run) => total + runActiveMs(run, now), 0)
    const completedUnits = completed.reduce((total, run) => total + run.unitsComplete, 0)

    byMember.set(member.id, {
      runsCompleted: completed.length,
      unitsComplete,
      activeMs,
      avgTactMs: completedUnits > 0 ? Math.round(completedActiveMs / completedUnits) : null,
      avgBuildMs: completed.length > 0 ? Math.round(completedActiveMs / completed.length) : null,
    })
  }

  return byMember
}

/**
 * NOT YET CONNECTED. Returns nothing until fabrication QC is wired to NetSuite.
 */
export async function getFabRequestQuality(): Promise<FabRequestQuality[]> {
  return []
}

/**
 * NOT YET CONNECTED. Every member gets an empty quality metric, never a zero
 * pass rate, because "nothing inspected" and "everything failed" must not look
 * the same on a dashboard.
 */
export async function getQualityByMember(): Promise<Map<string, FabQualityMetrics>> {
  return new Map(FAB_TEAM.map((member) => [member.id, EMPTY_QUALITY]))
}

export async function getFabTeamSummaries(): Promise<FabTeamMemberSummary[]> {
  const [throughput, quality] = await Promise.all([getThroughputByMember(), getQualityByMember()])

  return FAB_TEAM.map((member) => ({
    member,
    manager: getManagerFor(member),
    throughput: throughput.get(member.id) ?? emptyThroughput(),
    quality: quality.get(member.id) ?? EMPTY_QUALITY,
  }))
}

export async function getFabTeamSummary(memberId: string): Promise<FabTeamMemberSummary | null> {
  const member = getFabTeamMember(memberId)
  if (!member) {
    return null
  }

  const summaries = await getFabTeamSummaries()
  return summaries.find((summary) => summary.member.id === member.id) ?? null
}
