import { startRun, type NewRunInput } from '@/lib/calculations/fabrication'
import { resolveOperator } from '@/lib/fab-operator'
import { insertRun, listRuns, newId, type RunFilter } from '@/lib/queries/fab-runs'
import { FAB_STEPS } from '@/types/fabrication'

/**
 * Fabrication run collection.
 *
 * GET lists runs for the console and the leadership log. POST starts a run,
 * which is the single most important write in this feature: it is what the big
 * green button on the bench does.
 */

function badRequest(message: string) {
  return Response.json({ error: 'invalid_request', message }, { status: 400 })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const scope = params.get('scope')
  const limitRaw = params.get('limit')
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : NaN

  const filter: RunFilter = {
    projectNumber: params.get('project') ?? undefined,
    scope: scope === 'open' || scope === 'complete' ? scope : 'all',
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  }

  const runs = await listRuns(filter)
  return Response.json({ runs, serverNow: new Date().toISOString() })
}

/** Free text steps are allowed, but a blank or absurd one is not. */
function normalizeStep(value: unknown): string | null {
  if (typeof value !== 'string') {
    return FAB_STEPS[0]
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return FAB_STEPS[0]
  }
  return trimmed.length <= 40 ? trimmed : null
}

function normalizeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export async function POST(request: Request) {
  const operator = await resolveOperator()
  if (!operator) {
    return Response.json(
      { error: 'unauthenticated', message: 'Sign in before starting a run.' },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return badRequest('Body must be JSON.')
  }

  const projectNumber = normalizeText(body.projectNumber, 60)
  if (!projectNumber) {
    return badRequest('A project number is required. It is the key everything else hangs off.')
  }

  const description = normalizeText(body.description, 200)
  if (!description) {
    return badRequest('Describe what is being built, so the log reads as something a month from now.')
  }

  const step = normalizeStep(body.step)
  if (!step) {
    return badRequest('Step name is too long. Keep it under 40 characters.')
  }

  const targetUnitsRaw = Number(body.targetUnits ?? 0)
  if (!Number.isFinite(targetUnitsRaw) || targetUnitsRaw < 0 || targetUnitsRaw > 100_000) {
    return badRequest('Target units must be a number between 0 and 100000.')
  }

  const fabBin = normalizeText(body.fabBin, 20)
  const requestNumber = normalizeText(body.requestNumber, 60)
  const notes = normalizeText(body.notes, 1000)

  const input: NewRunInput = {
    projectNumber,
    requestNumber: requestNumber || null,
    description,
    fabBin: fabBin || null,
    targetUnits: Math.floor(targetUnitsRaw),
    step,
    notes: notes || null,
  }

  const run = startRun(input, operator, { nowIso: new Date().toISOString(), newId })
  await insertRun(run)

  return Response.json({ run, serverNow: new Date().toISOString() }, { status: 201 })
}
