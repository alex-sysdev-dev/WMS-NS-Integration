'use client'

import { useEffect } from 'react'
import { getSupabaseAuthBrowserClient } from '@/lib/supabase-auth-browser'

const RECOVERY_PATH = '/update-password?status=recovery'

/**
 * Handles Supabase recovery links that arrive at the root route as a URL hash
 * fragment (`/#type=recovery&access_token=...`). Hash fragments are never sent
 * to the server, so this check has to run in the browser. Anything that is not
 * a recovery link falls through to the dashboard.
 */
export default function RootRecoveryRedirect() {
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    if (hashParams.get('type') !== 'recovery') {
      window.location.replace('/dashboard')
      return
    }

    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      window.location.replace('/login?mode=reset&error=callback')
      return
    }

    getSupabaseAuthBrowserClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then((sessionResult: { error: unknown }) => {
        window.location.replace(sessionResult.error ? '/update-password?error=callback' : RECOVERY_PATH)
      })
  }, [])

  return null
}
