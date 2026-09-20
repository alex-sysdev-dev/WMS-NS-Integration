import 'server-only'

import { getCurrentUser } from '@/lib/auth/current-user'

export type Operator = {
  id: string
  name: string
}

/**
 * Who a run is attributed to.
 *
 * Every run carries the signed-in user, resolved server side from the session.
 * The client never sends an operator name, because a client that can name the
 * operator can name someone else, and a time log leadership reviews has to be
 * attributable.
 *
 * Returns null when nobody is signed in, and the caller answers 401.
 *
 * Identity itself lives in lib/auth/current-user.ts, so this stays correct
 * when staff move to Entra and associates move to their own credential path.
 */
export async function resolveOperator(): Promise<Operator | null> {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  return { id: user.id, name: user.name }
}
