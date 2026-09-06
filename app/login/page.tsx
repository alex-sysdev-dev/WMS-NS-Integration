import LoginForm from '@/components/auth/LoginForm'

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Auth.js reports failures as ?error=. These are the ones a person can act on;
 * anything else gets a generic line rather than a raw error code.
 */
function resolveMessage(error: string | undefined): string | null {
  if (!error) {
    return null
  }

  if (error === 'AccessDenied') {
    return 'That account is not permitted to use the warehouse app. Ask Alex to have it added.'
  }

  if (error === 'Verification') {
    return 'That sign-in link expired. Try again.'
  }

  return 'Sign-in did not complete. Try again.'
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}

  return (
    <LoginForm
      nextPath={firstParam(params.next) ?? '/dashboard'}
      message={resolveMessage(firstParam(params.error))}
    />
  )
}
