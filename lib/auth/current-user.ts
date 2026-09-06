import 'server-only'

import { auth } from '@/lib/auth/config'
import { isLocalDevAccessEnabled } from '@/lib/dev-access'
import { getFabTeamMember } from '@/lib/fab-team'
import { FAB_SURFACE_BY_ROLE, type FabSurface } from '@/types/fab-team'

/**
 * The one place the app asks "who is signed in".
 *
 * NetSuite is the only datastore, but it is not an identity provider, so
 * identity is the single concern that cannot follow the data there. Staff
 * authenticate through Microsoft Entra. Fabrication associates cannot: Omar is
 * a temp with no Microsoft account, and the fab laptops are shared, so the
 * station attributes work by badge scan per action rather than by session.
 * That second path is not built yet and does not belong in this file when it
 * is; it belongs behind this same function.
 *
 * Callers get an AppUser and never touch a provider, which is what kept the
 * Supabase removal to one file instead of nine.
 *
 * Do not add data reads here. This module answers identity only.
 */

export type AppUser = {
  id: string
  name: string
  email: string | null
  /** Immutable Entra object id, or null for non-Entra sessions. */
  entraOid: string | null
  /** Matching lib/fab-team.ts member id, or null if not on the fab roster. */
  fabMemberId: string | null
  /**
   * Which surface this user lands on. Null means no fab surface, which is the
   * normal case for LED staff who are not on the fab team, and they get the
   * full app instead.
   */
  fabSurface: FabSurface | null
  /**
   * True when this user came from the local development bypass rather than a
   * real session. Anything that writes an attributable record should surface
   * it, so a dev run is never mistaken for real floor activity.
   */
  isLocalDev: boolean
}

/** Stamped clearly enough that it can never read as a real associate. */
const LOCAL_DEV_USER: AppUser = {
  id: 'local-dev',
  name: 'Local Dev (unauthenticated)',
  email: null,
  entraOid: null,
  fabMemberId: null,
  fabSurface: null,
  isLocalDev: true,
}

/**
 * Resolves the signed-in user, or null when nobody is signed in. Throws
 * nothing: callers decide whether null means redirect or 401.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  if (isLocalDevAccessEnabled()) {
    return LOCAL_DEV_USER
  }

  const session = await auth()
  const user = session?.user

  if (!user) {
    return null
  }

  const fabMemberId = user.fabMemberId ?? null
  const member = fabMemberId ? getFabTeamMember(fabMemberId) : null
  const email = user.email ?? null

  return {
    id: user.entraOid ?? user.id ?? email ?? 'unknown',
    name: user.name?.trim() || email || 'Unknown user',
    email,
    entraOid: user.entraOid ?? null,
    fabMemberId,
    fabSurface: member ? FAB_SURFACE_BY_ROLE[member.role] : null,
    isLocalDev: false,
  }
}

/**
 * Same question, but never throws. An identity check that cannot run is not a
 * passed identity check, so a failure resolves to null and the caller denies.
 */
export async function getCurrentUserSafe(): Promise<AppUser | null> {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}
