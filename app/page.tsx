import LandingHero from '@/components/landing/LandingHero'

/**
 * Entry screen.
 *
 * This used to intercept Supabase password-recovery links that landed here as
 * ?code=, ?token_hash=, or a hash fragment, and forward them to the auth
 * handlers. Entra owns staff passwords now, so recovery happens in Microsoft
 * and never reaches this app. The interception and its client-side hash guard
 * are gone with it.
 */

export default function RootPage() {
  return <LandingHero />
}
