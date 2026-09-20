import type { FabTeamMember, FabTeamRole } from '@/types/fab-team'
import { FAB_SURFACE_BY_ROLE } from '@/types/fab-team'

/**
 * The fabrication team, as it stands.
 *
 * Held in code rather than a table on purpose. It is four people, it changes
 * a few times a year, and a roster nobody can edit without a code review is a
 * roster that cannot quietly drift out of sync with reality. When fabrication
 * is integrated and NetSuite carries employee records for these people, the
 * `netsuiteId` field is where they get linked, and this list becomes a
 * fallback rather than the source.
 *
 * No photographs. Nothing here is decorative.
 */
export const FAB_TEAM: FabTeamMember[] = [
  {
    id: 'matt-clark',
    fullName: 'Matt Clark',
    role: 'fabrication_manager',
    managerId: null,
    employmentType: 'staff',
    netsuiteId: null,
    authSubject: null,
    entraUpn: 'mattc@ledconnection.com',
    trackerInitials: [],
    // Reachable from the Fab Team page itself. Listing the manager under his
    // own reports in the sidebar reads as though he reports to himself.
    showInSidebar: false,
  },
  {
    id: 'brandon-lynn',
    fullName: 'Brandon Lynn',
    role: 'quality_control',
    managerId: 'matt-clark',
    employmentType: 'staff',
    netsuiteId: null,
    authSubject: null,
    entraUpn: 'brandonl@ledconnection.com',
    trackerInitials: ['BL'],
    showInSidebar: true,
  },
  {
    id: 'justin',
    fullName: 'Justin',
    role: 'fabrication_associate',
    managerId: 'matt-clark',
    employmentType: 'staff',
    netsuiteId: null,
    authSubject: null,
    entraUpn: 'justinp@ledconnection.com',
    trackerInitials: ['JP'],
    showInSidebar: true,
  },
  {
    id: 'omar',
    fullName: 'Omar',
    role: 'fabrication_associate',
    managerId: 'matt-clark',
    employmentType: 'temp',
    netsuiteId: null,
    authSubject: null,
    // Temp, no Microsoft account. Attribution comes from the station badge
    // scan, not from SSO. This stays null by design, not by omission.
    entraUpn: null,
    trackerInitials: ['OM'],
    showInSidebar: true,
  },
]

export function getFabTeamMember(id: string): FabTeamMember | null {
  return FAB_TEAM.find((member) => member.id === id) ?? null
}

export function getManagerFor(member: FabTeamMember): FabTeamMember | null {
  return member.managerId ? getFabTeamMember(member.managerId) : null
}

export function getDirectReports(managerId: string): FabTeamMember[] {
  return FAB_TEAM.filter((member) => member.managerId === managerId)
}

/** Members that get their own entry under the sidebar's Fab Team dropdown. */
export function getSidebarFabTeam(): { id: string; fullName: string; roleLabel: string }[] {
  return FAB_TEAM.filter((member) => member.showInSidebar).map((member) => ({
    id: member.id,
    fullName: member.fullName,
    roleLabel: SHORT_ROLE_LABELS[member.role],
  }))
}

/** Short enough for a 64-unit-wide sidebar column. */
const SHORT_ROLE_LABELS: Record<FabTeamRole, string> = {
  fabrication_manager: 'Manager',
  quality_control: 'QC',
  fabrication_associate: 'Associate',
}

export { SHORT_ROLE_LABELS, FAB_SURFACE_BY_ROLE }

/**
 * Whether this member can authenticate through Microsoft.
 *
 * Temps do not get Entra accounts, so the station surface cannot depend on
 * SSO. This is the predicate that decides which sign-in path a member takes,
 * and it is deliberately about the account rather than the role: a staff
 * associate and a temp associate do the same job through different doors.
 */
export function canUseMicrosoftSignIn(member: FabTeamMember): boolean {
  return member.employmentType === 'staff'
}
