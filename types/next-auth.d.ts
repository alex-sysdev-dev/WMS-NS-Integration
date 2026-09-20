import 'next-auth'
import 'next-auth/jwt'

/**
 * Extra claims the app puts on the session.
 *
 * `fabMemberId` is the join between an Entra identity and the fab roster in
 * lib/fab-team.ts. It is null for LED staff who are not on the fab team, which
 * is the normal case rather than an error: they sign in fine and simply have
 * no fab surface.
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      /** Immutable Entra object id. Null until a first sign-in has happened. */
      entraOid: string | null
      /** Matching lib/fab-team.ts member id, or null if not on the roster. */
      fabMemberId: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    entraOid?: string | null
    fabMemberId?: string | null
  }
}
