import 'server-only'

/**
 * Opt-in local development bypass for route protection.
 *
 * Set LOCAL_DEV_PLATFORM_ACCESS=true in .env.local to browse the operational
 * pages without signing in. This is hard-gated on NODE_ENV so it can never be
 * active in a production build.
 */
export function isLocalDevAccessEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEV_PLATFORM_ACCESS === 'true'
}
