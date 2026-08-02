import { redirect } from 'next/navigation'
import RootRecoveryRedirect from '@/components/auth/RootRecoveryRedirect'
import LandingHero from '@/components/landing/LandingHero'

type RootPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const RECOVERY_NEXT_PATH = '/update-password?status=recovery'

export default async function RootPage({ searchParams }: RootPageProps) {
  const params = (await searchParams) ?? {}
  const code = firstParam(params.code)
  const tokenHash = firstParam(params.token_hash)
  const type = firstParam(params.type)

  // Supabase password-recovery links can land on the root route. Forward the
  // query-param variants to the auth handlers before falling through.
  if (code) {
    const target = new URLSearchParams({ code, next: RECOVERY_NEXT_PATH })
    redirect(`/auth/callback?${target.toString()}`)
  }

  if (tokenHash) {
    const target = new URLSearchParams({
      token_hash: tokenHash,
      type: type ?? 'recovery',
      next: RECOVERY_NEXT_PATH,
    })
    redirect(`/auth/confirm?${target.toString()}`)
  }

  // The hash-fragment recovery variant is only visible to the browser, so the
  // guard runs client-side and forwards only when it sees a recovery link.
  // Everything else lands on the entry screen.
  return (
    <>
      <RootRecoveryRedirect />
      <LandingHero />
    </>
  )
}
