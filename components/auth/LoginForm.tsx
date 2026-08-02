'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getSupabaseAuthBrowserClient } from '@/lib/supabase-auth-browser'

type LoginMode = 'login' | 'reset' | 'update-password'

type LoginFormProps = {
  initialMode: LoginMode
  initialNextPath: string
  initialMessage: string | null
  initialEmail?: string
}

function normalizeNextPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

function modeTitle(mode: LoginMode): string {
  if (mode === 'reset') return 'Reset Password'
  if (mode === 'update-password') return 'Set New Password'
  return 'Log In'
}

function modeDescription(mode: LoginMode): string {
  if (mode === 'reset') return 'Send a password recovery link'
  if (mode === 'update-password') return 'Choose a new password for this account'
  return 'Use your account credentials'
}

function passwordMeetsMinimum(value: string): boolean {
  return value.length >= 8
}

export default function LoginForm({
  initialMode,
  initialNextPath,
  initialMessage,
  initialEmail = '',
}: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>(initialMode)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(initialMessage)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'update-password' || typeof window === 'undefined') {
      return
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (hashParams.get('type') !== 'recovery') {
      return
    }

    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (!accessToken || !refreshToken) {
      setError('That reset link could not be confirmed. Request a fresh reset link.')
      return
    }

    async function applyRecoverySession() {
      const { error: sessionError } = await getSupabaseAuthBrowserClient()
        .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

      if (sessionError) {
        setError('That reset link could not be confirmed. Request a fresh reset link.')
        return
      }

      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      setMessage('Enter a new password to finish resetting your account.')
    }

    void applyRecoverySession()
  }, [mode])

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode)
    setError(null)
    setMessage(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const normalizedEmail = email.trim().toLowerCase()

    try {
      if (mode === 'reset') {
        const resetResponse = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        const resetPayload = (await resetResponse.json().catch(() => null)) as { message?: string } | null

        if (!resetResponse.ok) {
          setError(resetPayload?.message ?? 'Could not send password reset email.')
          return
        }

        setMessage(resetPayload?.message ?? 'Password reset link sent. Check your email.')
        return
      }

      const supabase = getSupabaseAuthBrowserClient()

      if (mode === 'update-password') {
        if (!passwordMeetsMinimum(password)) {
          setError('Password must be at least 8 characters.')
          return
        }

        const { error: updateError } = await supabase.auth.updateUser({ password })

        if (updateError) {
          setError(updateError.message)
          return
        }

        setPassword('')
        setMessage('Password updated. You can log in now.')
        setMode('login')
        return
      }

      if (!passwordMeetsMinimum(password)) {
        setError('Password must be at least 8 characters.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      window.location.assign(normalizeNextPath(initialNextPath))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const isReset = mode === 'reset'
  const isUpdatePassword = mode === 'update-password'
  const submitLabel = isReset ? 'Send Reset Link' : isUpdatePassword ? 'Update Password' : 'Log In'

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-full border border-orange-500/40 bg-zinc-950 flex items-center justify-center">
            <Image src="/login.svg" alt="LED Connection" width={20} height={20} className="opacity-90" />
          </div>
          <span className="text-xl font-bold">
            <span className="text-orange-500">LED</span>
            <span className="text-zinc-100"> Connection</span>
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-md p-8">
          <h1 className="text-lg mb-1 font-semibold text-zinc-50">{modeTitle(mode)}</h1>
          <p className="text-sm text-zinc-300 mb-6 tracking-wide">{modeDescription(mode)}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!isUpdatePassword ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-zinc-300">Email</label>
                <input
                  type="email"
                  required
                  suppressHydrationWarning
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-50 placeholder-zinc-400 transition-colors focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
                />
              </div>
            ) : null}

            {!isReset ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-zinc-300">
                  {isUpdatePassword ? 'New Password' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  suppressHydrationWarning
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-50 placeholder-zinc-400 transition-colors focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
                />
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-100">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-100">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              suppressHydrationWarning
              className="mt-2 w-full rounded-xl border border-orange-500/50 bg-orange-600/20 py-3 text-sm font-semibold tracking-[0.15em] uppercase text-orange-100 transition-all duration-200 hover:bg-orange-600/35 hover:border-orange-400/70 hover:shadow-[0_0_32px_rgba(210,101,15,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Working...' : submitLabel}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest">
            {mode !== 'login' ? (
              <button type="button" onClick={() => switchMode('login')} className="text-orange-300 hover:text-orange-100">
                Log In
              </button>
            ) : null}
            {mode !== 'reset' ? (
              <button type="button" onClick={() => switchMode('reset')} className="text-zinc-500 hover:text-zinc-300">
                {mode === 'update-password' ? 'Request Fresh Link' : 'Reset Password'}
              </button>
            ) : null}
          </div>

          <p className="mt-5 text-center text-[10px] tracking-widest text-zinc-700 uppercase">
            Secure Access
          </p>
        </div>
      </div>
    </div>
  )
}
