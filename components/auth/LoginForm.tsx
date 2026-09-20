import Image from 'next/image'

import { isEntraConfigured, signIn } from '@/lib/auth/config'

/**
 * Sign in with a Microsoft work account.
 *
 * There is no email and password form because there are no app-held passwords
 * any more. Entra owns staff credentials, which means it also owns password
 * reset, MFA, and offboarding, and none of those are this app's job.
 *
 * This covers staff only. Fabrication associates sign in through the station
 * badge scan, because Omar is a temp with no Microsoft account and the fab
 * laptops are shared, so a session-based login would attribute a whole week of
 * timer activity to whoever logged in first. That surface is separate and does
 * not route through this form.
 *
 * A server component: the sign-in call is a server action, so no provider
 * client reaches the browser.
 */

type LoginFormProps = {
  nextPath?: string
  /** Shown after a failed callback, or when the app redirected the user here. */
  message?: string | null
  /**
   * 'page' centres the card in its own full-height black screen, used by
   * /login which has no surrounding layout. 'embedded' drops that wrapper and
   * the logo header so the card can sit inside a page that already provides
   * both, such as the landing hero.
   */
  variant?: 'page' | 'embedded'
}

/** Blocks an open redirect through ?next=. */
function normalizeNextPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export default function LoginForm({
  nextPath = '/dashboard',
  message = null,
  variant = 'page',
}: LoginFormProps) {
  const isEmbedded = variant === 'embedded'
  const configured = isEntraConfigured()
  const redirectTo = normalizeNextPath(nextPath)

  return (
    <div
      className={
        isEmbedded ? 'w-full' : 'min-h-screen bg-black flex items-center justify-center px-4'
      }
    >
      <div className={isEmbedded ? 'w-full' : 'w-full max-w-sm'}>
        {isEmbedded ? null : (
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/brand/led-connection-logo-orwh.webp"
              alt="LED Connection"
              width={800}
              height={700}
              className="h-auto w-[168px]"
            />
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-md p-8">
          <h1 className="text-lg mb-1 font-semibold text-zinc-50">Log In</h1>
          <p className="text-sm text-zinc-300 mb-6 tracking-wide">
            Use your LED Connection Microsoft account
          </p>

          {message ? (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-100">
              {message}
            </div>
          ) : null}

          {configured ? (
            <form
              action={async () => {
                'use server'
                await signIn('microsoft-entra-id', { redirectTo })
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 cursor-pointer"
              >
                Continue with Microsoft
              </button>
            </form>
          ) : (
            /*
             * No app registration yet, so there is nothing to click. An honest
             * notice beats a button that fails, and this is the same rule the
             * unconnected data pages follow.
             */
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-100">
              <p className="font-semibold">Microsoft sign-in is not configured yet.</p>
              <p className="mt-1.5 text-amber-100/80">
                The Entra app registration has not been created, so there is no sign-in to offer.
                Set LOCAL_DEV_PLATFORM_ACCESS in .env.local to browse the app in development.
              </p>
            </div>
          )}

          <p className="mt-6 border-t border-zinc-800 pt-4 text-[11px] leading-relaxed text-zinc-500">
            Fabrication associates do not sign in here. Time on the floor is attributed by badge
            scan at the station.
          </p>
        </div>
      </div>
    </div>
  )
}
