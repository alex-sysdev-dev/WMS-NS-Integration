import FabFloorWorkspace from '@/components/fabrication/FabFloorWorkspace'
import InterimStoreNotice from '@/components/fabrication/InterimStoreNotice'
import { listDocs, snapshotRuns } from '@/lib/queries/fab-runs'

export const dynamic = 'force-dynamic'

/**
 * The bench page.
 *
 * Open runs and the documents for whichever project is on the bench are read
 * on the server so the console renders with a running clock on first paint. A
 * client-side fetch here would show an empty timer for a beat, which on a
 * shared tablet reads as "my run is gone".
 */
export default async function FabricationFloorPage() {
  const { runs: openRuns, readAtMs } = await snapshotRuns({ scope: 'open' })
  const docs = await listDocs(openRuns[0]?.projectNumber)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="text-orange-500">Fab</span>{' '}
          <span className="text-[var(--foreground)]">Floor</span>
        </h1>
        <p className="max-w-3xl text-zinc-400">
          Start the clock when hands go on the build, pause it when they come off. Time is logged
          per step, so the breakdown shows where a build actually spends its hours rather than just
          how long it took start to finish.
        </p>
      </header>

      <InterimStoreNotice />

      <FabFloorWorkspace
        initialRuns={openRuns}
        initialServerNow={new Date(readAtMs).toISOString()}
        initialDocs={docs}
      />
    </div>
  )
}
