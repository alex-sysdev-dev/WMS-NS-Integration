'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { FabDocKind, FabDocLink, FabDocSource } from '@/types/fabrication'

/**
 * Fab sheets and diagrams for the build on the bench.
 *
 * This panel holds links, never copies. The files are attached in monday.com
 * today and are moving into NetSuite, and a duplicate stored here would become
 * the version the bench builds from after the real one was revised. So a tile
 * opens the file in its own system, and the tile says which system that is.
 *
 * Inline preview is offered only when someone supplied an embed link, because
 * monday.com asset links and plain SharePoint share links both refuse to be
 * framed. Rendering them in an iframe produces a blank grey box with no error,
 * which reads as a broken app rather than as an unsupported link.
 */

const KIND_LABELS: Record<FabDocKind, string> = {
  fab_sheet: 'Fab sheet',
  diagram: 'Diagram',
  cut_list: 'Cut list',
  photo: 'Photo',
  other: 'Document',
}

const SOURCE_LABELS: Record<FabDocSource, string> = {
  monday: 'monday.com',
  netsuite: 'NetSuite',
  sharepoint: 'SharePoint',
  link: 'Link',
}

const KIND_ORDER: FabDocKind[] = ['fab_sheet', 'diagram', 'cut_list', 'photo', 'other']

type Props = {
  /** Project the bench is building. Null shows the shared documents only. */
  projectNumber: string | null
  initialDocs: FabDocLink[]
}

type AddForm = {
  label: string
  url: string
  embedUrl: string
  kind: FabDocKind
  source: FabDocSource
  sharedAcrossProjects: boolean
}

const EMPTY_ADD: AddForm = {
  label: '',
  url: '',
  embedUrl: '',
  kind: 'fab_sheet',
  source: 'monday',
  sharedAcrossProjects: false,
}

export default function FabDocsPanel({ projectNumber, initialDocs }: Props) {
  const [docs, setDocs] = useState<FabDocLink[]>(initialDocs)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_ADD)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = projectNumber ? '?project=' + encodeURIComponent(projectNumber) : ''

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/fabrication/docs' + query, { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const payload = (await response.json()) as { docs: FabDocLink[] }
      setDocs(payload.docs)
    } catch {
      // Leave the list as it is. Stale links still open.
    }
  }, [query])

  // The project changes when the operator switches benches, so the list follows.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const sorted = useMemo(
    () =>
      [...docs].sort((a, b) => {
        const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
        return byKind !== 0 ? byKind : a.label.localeCompare(b.label)
      }),
    [docs]
  )

  const preview = sorted.find((doc) => doc.id === previewId) ?? null

  const add = useCallback(async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/fabrication/docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectNumber: form.sharedAcrossProjects ? '*' : projectNumber ?? '*',
          label: form.label,
          url: form.url,
          embedUrl: form.embedUrl || null,
          kind: form.kind,
          source: form.source,
        }),
      })
      const payload = (await response.json()) as { doc?: FabDocLink; message?: string }
      if (!response.ok || !payload.doc) {
        setError(payload.message ?? 'Could not attach that document.')
        return
      }
      setDocs((current) => [...current, payload.doc as FabDocLink])
      setForm(EMPTY_ADD)
      setShowAdd(false)
    } catch {
      setError('Could not reach the server. Nothing was attached.')
    } finally {
      setPending(false)
    }
  }, [form, projectNumber])

  const remove = useCallback(async (id: string) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/fabrication/docs?id=' + encodeURIComponent(id), {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        setError(payload.message ?? 'Could not remove that link.')
        return
      }
      setDocs((current) => current.filter((doc) => doc.id !== id))
      setPreviewId((current) => (current === id ? null : current))
    } catch {
      setError('Could not reach the server. Nothing was removed.')
    } finally {
      setPending(false)
    }
  }, [])

  const fieldClass =
    'min-h-12 w-full rounded-xl border border-zinc-700 bg-[#0F0F11] px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none'

  return (
    <section className="rounded-2xl border border-zinc-700/70 bg-[#151517] p-6">
      <header className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold text-zinc-100">Build documents</h2>
        <button
          type="button"
          onClick={() => setShowAdd((current) => !current)}
          className="text-sm font-semibold text-orange-400 transition hover:text-orange-300"
        >
          {showAdd ? 'Close' : 'Attach a link'}
        </button>
      </header>
      <p className="mb-5 text-sm text-zinc-400">
        {projectNumber
          ? 'Fab sheets and diagrams for project ' + projectNumber + ', plus anything shared across every build.'
          : 'Documents shared across every build. Start a run to see the ones attached to its project.'}
      </p>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100"
        >
          {error}
        </div>
      )}

      {showAdd && (
        <form
          className="mb-6 space-y-4 rounded-xl border border-zinc-800 bg-[#0F0F11] p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Label</span>
            <input
              className={fieldClass}
              value={form.label}
              onChange={(event) => setForm((c) => ({ ...c, label: event.target.value }))}
              placeholder="e.g. Cabinet frame fab sheet rev C"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Link</span>
            <input
              className={fieldClass}
              value={form.url}
              onChange={(event) => setForm((c) => ({ ...c, url: event.target.value }))}
              placeholder="https://..."
              type="url"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">
              Embed link <span className="text-zinc-500">(optional, enables inline preview)</span>
            </span>
            <input
              className={fieldClass}
              value={form.embedUrl}
              onChange={(event) => setForm((c) => ({ ...c, embedUrl: event.target.value }))}
              placeholder="https://..."
              type="url"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-300">Type</span>
              <select
                className={fieldClass}
                value={form.kind}
                onChange={(event) =>
                  setForm((c) => ({ ...c, kind: event.target.value as FabDocKind }))
                }
              >
                {KIND_ORDER.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-300">Lives in</span>
              <select
                className={fieldClass}
                value={form.source}
                onChange={(event) =>
                  setForm((c) => ({ ...c, source: event.target.value as FabDocSource }))
                }
              >
                {(Object.keys(SOURCE_LABELS) as FabDocSource[]).map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-zinc-700 bg-[#0F0F11]"
              checked={form.sharedAcrossProjects}
              onChange={(event) =>
                setForm((c) => ({ ...c, sharedAcrossProjects: event.target.checked }))
              }
            />
            Shared across every build, not just this project
          </label>

          <button
            type="submit"
            disabled={pending}
            className="min-h-12 w-full rounded-xl bg-orange-500 px-6 text-base font-semibold text-orange-950 transition hover:bg-orange-400 disabled:opacity-50"
          >
            {pending ? 'Attaching...' : 'Attach'}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 px-5 py-8 text-center text-sm text-zinc-500">
          No documents attached yet. Paste the monday.com link to the fab sheet and it shows up here
          for anyone on this project.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((doc) => (
            <li key={doc.id} className="rounded-xl border border-zinc-800 bg-[#0F0F11]">
              <div className="flex items-stretch">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-16 flex-1 px-5 py-3 transition hover:bg-white/[0.03]"
                >
                  <div className="text-base font-semibold text-zinc-100">{doc.label}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {KIND_LABELS[doc.kind]} · {SOURCE_LABELS[doc.source]}
                    {doc.projectNumber === '*' ? ' · all builds' : ''}
                  </div>
                </a>
                <div className="flex flex-none items-center gap-1 px-3">
                  {doc.embedUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewId((c) => (c === doc.id ? null : doc.id))}
                      className="min-h-12 rounded-lg px-3 text-xs font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                    >
                      {previewId === doc.id ? 'Hide' : 'Preview'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(doc.id)}
                    disabled={pending}
                    className="min-h-12 rounded-lg px-3 text-xs font-semibold text-zinc-600 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    aria-label={'Remove ' + doc.label}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview?.embedUrl && (
        <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0F0F11] px-4 py-2">
            <span className="text-sm font-semibold text-zinc-200">{preview.label}</span>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-orange-400 hover:text-orange-300"
            >
              Open full size
            </a>
          </div>
          <iframe
            src={preview.embedUrl}
            title={preview.label}
            className="h-[600px] w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}
    </section>
  )
}
