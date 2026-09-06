import NextAuth, { type NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

import { FAB_TEAM } from '@/lib/fab-team'

/**
 * Microsoft Entra sign-in for LED staff.
 *
 * This is one of two identity paths, not the whole story. Entra covers Matt,
 * Brandon, Justin, and anyone else with an LED Microsoft account. It cannot
 * cover Omar, who is a temp with no account, so the fabrication station keeps
 * its own attribution path by badge scan. Do not fold the two together.
 *
 * Nothing outside lib/auth/ imports this. The app asks
 * lib/auth/current-user.ts who is signed in and never touches a provider.
 *
 * Not configured yet. The tenant, client id, and secret come from an app
 * registration that has to be created by an M365 admin, so every helper here
 * degrades to "not configured" rather than throwing at import time. A missing
 * app registration should leave the app browsable through the local dev
 * bypass, not crash it on boot.
 */

/** Scopes are deliberately minimal: who you are, nothing else. */
const ENTRA_SCOPES = 'openid profile email'

/**
 * True once an admin has supplied the app registration. Until then sign-in is
 * unavailable and the login page says so rather than offering a button that
 * fails on click.
 */
export function isEntraConfigured(): boolean {
  return Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
  )
}

/**
 * Resolves an Entra identity to a fab team member.
 *
 * Matching is by object id first, since that is immutable, then by email as
 * the seed case: the roster is filled in from email addresses before anyone
 * has signed in, and the object id is only knowable after a first sign-in.
 *
 * Returns null for LED staff who are not on the fab roster, which is the
 * normal case. They are still signed in, they simply have no fab surface.
 */
function resolveFabMemberId(oid: string | null, email: string | null): string | null {
  const normalizedEmail = email?.trim().toLowerCase() ?? null

  for (const member of FAB_TEAM) {
    if (oid && member.authSubject && member.authSubject === oid) {
      return member.id
    }
  }

  if (!normalizedEmail) {
    return null
  }

  for (const member of FAB_TEAM) {
    if (member.entraUpn && member.entraUpn.toLowerCase() === normalizedEmail) {
      return member.id
    }
  }

  return null
}

export const authConfig: NextAuthConfig = {
  providers: isEntraConfigured()
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          authorization: { params: { scope: ENTRA_SCOPES } },
        }),
      ]
    : [],

  // The app renders its own sign-in page rather than the Auth.js default.
  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },

  callbacks: {
    /**
     * Stamps the Entra object id and the resolved roster member onto the token
     * once, at sign-in, rather than re-deriving them on every request.
     */
    async jwt({ token, profile }) {
      if (profile) {
        const oid = typeof profile.oid === 'string' ? profile.oid : null
        const email =
          (typeof profile.email === 'string' && profile.email) ||
          (typeof profile.preferred_username === 'string' && profile.preferred_username) ||
          null

        token.entraOid = oid
        token.fabMemberId = resolveFabMemberId(oid, email)
      }

      return token
    },

    async session({ session, token }) {
      session.user.entraOid = typeof token.entraOid === 'string' ? token.entraOid : null
      session.user.fabMemberId = typeof token.fabMemberId === 'string' ? token.fabMemberId : null
      return session
    },
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
