import { handlers } from '@/lib/auth/config'

/**
 * Auth.js callback and session endpoints.
 *
 * The Entra redirect URI registered in Azure points at
 * /api/auth/callback/microsoft-entra-id, which this handler serves. Both a
 * localhost URI and the production one have to be registered on the app
 * registration before sign-in works from either.
 */

export const { GET, POST } = handlers
