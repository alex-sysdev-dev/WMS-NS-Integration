import {
  pauseRun,
  resumeRun,
  setNotes,
  setUnitsComplete,
  stopRun,
  switchStep,
  type TransitionContext,
} from '@/lib/calculations/fabrication'
import { resolveOperator } from '@/lib/fab-operator'
import { getRun, newId, updateRun } from '@/lib/queries/fab-runs'
import type { FabRun } from '@/types/fabrication'

/**
 * One fabrication run.
 *
 * PATCH takes an action rather than a patch document. The floor does not edit
 * fields, it taps buttons, and each button is a state transition with rules the
 * client should not be trusted to apply. The transition runs server side
 * against the run as stored, so a tablet that has been asleep for an hour
 * cannot overwrite the segment list with what it last saw.
 */

type Action =
  | 'pause'
  | 'resume'
  | 'stop'
  | 'switch_step'
  | 'set_units'
  | 'set_notes'

const ACTIONS: Action[] = ['pause', 'resume', 'stop', 'switch_step', 'set_units', 'set_notes']

function badRequest(message: string) {
  return Response.json({ error: 'invalid_request', message }, { status: 400 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const run = await getRun(runId)

  if (!run) {
    return Response.json(
      { error: 'not_found', message: 'No run with that id.' },
      { status: 404 }
    )
  }

  return Response.json({ run, serverNow: new Date().toISOString() })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const operator = await resolveOperator()
  if (!operator) {
    return Response.json(
      { error: 'unauthenticated', message: 'Sign in before changing a run.' },
      { status: 401 }
    )
  }

  const { runId } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return badRequest('Body must be JSON.')
  }

  const action = body.action as Action
  if (!ACTIONS.includes(action)) {
    return badRequest('Unknown action. Expected one of: ' + ACTIONS.join(', ') + '.')
  }

  const nowIso = new Date().toISOString()
  const ctx: TransitionContext = { nowIso, newId }

  let transition: (run: FabRun) => FabRun

  switch (action) {
    case 'pause':
      transition = (run) => pauseRun(run, nowIso)
      break

    case 'resume': {
      const step = typeof body.step === 'string' ? body.step.trim() : ''
      // Resuming without naming a step continues whatever step the run was on
      // when it paused, which is almost always what the bench means.
      transition = (run) => {
        const lastStep = run.segments[run.segments.length - 1]?.step ?? 'Build'
        return resumeRun(run, step || lastStep, ctx)
      }
      break
    }

    case 'stop':
      transition = (run) => stopRun(run, nowIso)
      break

    case 'switch_step': {
      const step = typeof body.step === 'string' ? body.step.trim() : ''
      if (!step) {
        return badRequest('switch_step needs a step name.')
      }
      if (step.length > 40) {
        return badRequest('Step name is too long. Keep it under 40 characters.')
      }
      transition = (run) => switchStep(run, step, ctx)
      break
    }

    case 'set_units': {
      const units = Number(body.unitsComplete)
      if (!Number.isFinite(units) || units < 0 || units > 100_000) {
        return badRequest('unitsComplete must be a number between 0 and 100000.')
      }
      transition = (run) => setUnitsComplete(run, units, nowIso)
      break
    }

    case 'set_notes': {
      const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : ''
      transition = (run) => setNotes(run, notes || null, nowIso)
      break
    }
  }

  const run = await updateRun(runId, transition)

  if (!run) {
    return Response.json(
      { error: 'not_found', message: 'No run with that id.' },
      { status: 404 }
    )
  }

  return Response.json({ run, serverNow: new Date().toISOString() })
}
