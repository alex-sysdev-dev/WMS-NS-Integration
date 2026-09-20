import { resolveOperator } from '@/lib/fab-operator'
import { lookupProject } from '@/lib/queries/netsuite-project'

/**
 * Project lookup for the start form.
 *
 * Read-only. Behind the same sign-in as the rest of the console, because an
 * open endpoint that resolves project numbers is a way to enumerate the job
 * list without an account.
 */

export async function GET(request: Request) {
  const operator = await resolveOperator()
  if (!operator) {
    return Response.json(
      { error: 'unauthenticated', message: 'Sign in before looking up a project.' },
      { status: 401 }
    )
  }

  const projectNumber = new URL(request.url).searchParams.get('number')?.trim() ?? ''

  if (!projectNumber) {
    return Response.json(
      { error: 'invalid_request', message: 'A project number is required.' },
      { status: 400 }
    )
  }

  if (projectNumber.length > 60) {
    return Response.json(
      { error: 'invalid_request', message: 'Project number is too long.' },
      { status: 400 }
    )
  }

  const result = await lookupProject(projectNumber)
  return Response.json(result)
}
