import { resolveOperator } from '@/lib/fab-operator'
import { deleteDoc, insertDoc, listDocs, newId } from '@/lib/queries/fab-runs'
import type { FabDocKind, FabDocLink, FabDocSource } from '@/types/fabrication'

/**
 * Links to the fab sheets and diagrams a build needs.
 *
 * The WMS stores a link, never a copy. The files live in monday.com today and
 * are moving into NetSuite, and a second copy sitting in this app would be the
 * one the bench builds from after the real one changed.
 */

const KINDS: FabDocKind[] = ['fab_sheet', 'diagram', 'cut_list', 'photo', 'other']
const SOURCES: FabDocSource[] = ['monday', 'netsuite', 'sharepoint', 'link']

function badRequest(message: string) {
  return Response.json({ error: 'invalid_request', message }, { status: 400 })
}

/**
 * Only http and https.
 *
 * These strings end up in an href and an iframe src. A javascript: or data:
 * URL pasted into the label field would then run in the operator's session,
 * so the scheme is checked here rather than trusted at render time.
 */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const project = new URL(request.url).searchParams.get('project')
  const docs = await listDocs(project ?? undefined)
  return Response.json({ docs })
}

export async function POST(request: Request) {
  const operator = await resolveOperator()
  if (!operator) {
    return Response.json(
      { error: 'unauthenticated', message: 'Sign in before attaching a document.' },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return badRequest('Body must be JSON.')
  }

  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : ''
  if (!label) {
    return badRequest('Give the document a label the floor will recognise.')
  }

  const url = safeUrl(body.url)
  if (!url) {
    return badRequest('The link must be a full http or https URL.')
  }

  // An unusable embed link is dropped rather than rejected, so a bad paste in
  // an optional field does not block attaching a document that is otherwise fine.
  const embedUrl = safeUrl(body.embedUrl)

  const projectNumber =
    typeof body.projectNumber === 'string' && body.projectNumber.trim()
      ? body.projectNumber.trim().slice(0, 60)
      : '*'

  const kind = KINDS.includes(body.kind as FabDocKind) ? (body.kind as FabDocKind) : 'other'
  const source = SOURCES.includes(body.source as FabDocSource)
    ? (body.source as FabDocSource)
    : 'link'

  const doc: FabDocLink = {
    id: newId(),
    projectNumber,
    label,
    kind,
    source,
    url,
    embedUrl,
    addedBy: operator.name,
    addedAt: new Date().toISOString(),
  }

  await insertDoc(doc)
  return Response.json({ doc }, { status: 201 })
}

export async function DELETE(request: Request) {
  const operator = await resolveOperator()
  if (!operator) {
    return Response.json(
      { error: 'unauthenticated', message: 'Sign in before removing a document.' },
      { status: 401 }
    )
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return badRequest('Pass the document id as ?id=.')
  }

  const removed = await deleteDoc(id)
  if (!removed) {
    return Response.json(
      { error: 'not_found', message: 'No document with that id.' },
      { status: 404 }
    )
  }

  return Response.json({ ok: true })
}
