import 'server-only'

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

import type { FabDocLink, FabRun } from '@/types/fabrication'

/**
 * The fabrication run store. Interim by design.
 *
 * Fabrication is being built in NetSuite. Until that record exists and this
 * repo is cleared to write to it, tact time has nowhere to live: NetSuite
 * writes are off the table, and Supabase is legacy scaffolding that is not to
 * be extended. The floor still needs a start button today, so runs land in a
 * JSON file on the server the app runs on.
 *
 * What that buys and what it costs, plainly:
 *   - Shared. Every device that hits this server sees the same log, which is
 *     the whole point over browser storage.
 *   - Durable across restarts and deploys, as long as the data directory is on
 *     a real disk. This will NOT survive a serverless host that hands each
 *     invocation a fresh filesystem. On Vercel or similar, this store silently
 *     becomes per-instance and the log fragments.
 *   - Single writer. Correct for one Node process. Two processes behind a load
 *     balancer would interleave read-modify-write and lose runs.
 *
 * Migration path when the NetSuite fabrication record is live: replace the
 * bodies of readStore / writeStore with RESTlet or SuiteQL calls. Every
 * function below, the API routes, and the whole UI stay as they are, because
 * nothing above this file knows the runs are in a file.
 */

type StoreFile = {
  version: 1
  runs: FabRun[]
  docs: FabDocLink[]
}

const EMPTY_STORE: StoreFile = { version: 1, runs: [], docs: [] }

function storePath(): string {
  return (
    process.env.FAB_RUN_STORE_PATH ??
    path.join(process.cwd(), 'data', 'fabrication-runs.json')
  )
}

/**
 * Serializes every store access through one promise chain.
 *
 * Without this, two operators tapping stop in the same tick both read the file,
 * both mutate their own copy, and the second write erases the first run. A
 * module level chain is enough because there is one Node process; if this app
 * ever runs multiple instances, this file has to move to a real datastore
 * rather than grow a lock.
 */
let chain: Promise<unknown> = Promise.resolve()

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work)
  chain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoreFile>
    return {
      version: 1,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      // First run on a fresh machine. An absent file is an empty log, not a
      // fault, and must not be reported as one.
      return { ...EMPTY_STORE }
    }
    throw error
  }
}

/**
 * Writes to a temp file and renames over the target.
 *
 * A partial write on a crash would otherwise leave truncated JSON and every
 * historical run would be unreadable. Rename is atomic on both NTFS and POSIX,
 * so a reader sees either the old file or the whole new one.
 */
async function writeStore(store: StoreFile): Promise<void> {
  const target = storePath()
  await mkdir(path.dirname(target), { recursive: true })
  const temp = target + '.' + randomUUID() + '.tmp'
  await writeFile(temp, JSON.stringify(store, null, 2), 'utf8')
  await rename(temp, target)
}

function byNewestStart(a: FabRun, b: FabRun): number {
  return Date.parse(b.startedAt) - Date.parse(a.startedAt)
}

export type RunFilter = {
  /** Only runs on this project number. */
  projectNumber?: string
  /** 'open' means running or paused. */
  scope?: 'all' | 'open' | 'complete'
  limit?: number
}

export async function listRuns(filter: RunFilter = {}): Promise<FabRun[]> {
  return serialize(async () => {
    const { runs } = await readStore()
    let result = [...runs].sort(byNewestStart)

    if (filter.projectNumber) {
      const wanted = filter.projectNumber.trim().toLowerCase()
      result = result.filter((run) => run.projectNumber.toLowerCase() === wanted)
    }
    if (filter.scope === 'open') {
      result = result.filter((run) => run.state !== 'complete')
    }
    if (filter.scope === 'complete') {
      result = result.filter((run) => run.state === 'complete')
    }
    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit)
    }
    return result
  })
}

export type RunSnapshot = {
  runs: FabRun[]
  /** When the store was actually read. Open runs are measured against this. */
  readAtMs: number
}

/**
 * Runs plus the instant they were read.
 *
 * A page showing durations for builds still in progress has to state what
 * moment those durations are measured to, and the honest answer is when the
 * data was read, not when the markup rendered. Returning both together means
 * the page cannot accidentally pair a stale read with a fresh clock.
 */
export async function snapshotRuns(filter: RunFilter = {}): Promise<RunSnapshot> {
  const runs = await listRuns(filter)
  return { runs, readAtMs: Date.now() }
}

export async function getRun(runId: string): Promise<FabRun | null> {
  return serialize(async () => {
    const { runs } = await readStore()
    return runs.find((run) => run.id === runId) ?? null
  })
}

export async function insertRun(run: FabRun): Promise<FabRun> {
  return serialize(async () => {
    const store = await readStore()
    await writeStore({ ...store, runs: [...store.runs, run] })
    return run
  })
}

/**
 * Read-modify-write against one run, inside the serialized chain.
 *
 * The transition is applied to the run as it exists on disk, not to a copy the
 * client sent back, so a stale tablet cannot resurrect an old segment list.
 * Returns null when the run is gone.
 */
export async function updateRun(
  runId: string,
  transition: (run: FabRun) => FabRun
): Promise<FabRun | null> {
  return serialize(async () => {
    const store = await readStore()
    const index = store.runs.findIndex((run) => run.id === runId)
    if (index === -1) {
      return null
    }
    const updated = transition(store.runs[index])
    const runs = [...store.runs]
    runs[index] = updated
    await writeStore({ ...store, runs })
    return updated
  })
}

/* --------------------------- Build documents ----------------------------- */

/**
 * Documents for a project, plus the ones marked '*' that apply to every build.
 * Project specific documents sort first, because that is what the bench wants.
 */
export async function listDocs(projectNumber?: string): Promise<FabDocLink[]> {
  return serialize(async () => {
    const { docs } = await readStore()
    if (!projectNumber) {
      return [...docs].sort((a, b) => a.label.localeCompare(b.label))
    }
    const wanted = projectNumber.trim().toLowerCase()
    return docs
      .filter(
        (doc) =>
          doc.projectNumber === '*' || doc.projectNumber.toLowerCase() === wanted
      )
      .sort((a, b) => {
        if (a.projectNumber === b.projectNumber) {
          return a.label.localeCompare(b.label)
        }
        return a.projectNumber === '*' ? 1 : -1
      })
  })
}

export async function insertDoc(doc: FabDocLink): Promise<FabDocLink> {
  return serialize(async () => {
    const store = await readStore()
    await writeStore({ ...store, docs: [...store.docs, doc] })
    return doc
  })
}

export async function deleteDoc(docId: string): Promise<boolean> {
  return serialize(async () => {
    const store = await readStore()
    const docs = store.docs.filter((doc) => doc.id !== docId)
    if (docs.length === store.docs.length) {
      return false
    }
    await writeStore({ ...store, docs })
    return true
  })
}

export function newId(): string {
  return randomUUID()
}
