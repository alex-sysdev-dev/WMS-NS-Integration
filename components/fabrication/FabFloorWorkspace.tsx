'use client'

import { useCallback, useState } from 'react'

import FabDocsPanel from '@/components/fabrication/FabDocsPanel'
import FabRunConsole from '@/components/fabrication/FabRunConsole'
import type { FabDocLink, FabRun } from '@/types/fabrication'

/**
 * Pairs the timer with the paperwork.
 *
 * These two are separate components because they do genuinely separate jobs,
 * but the document panel has to know which project is on the bench, and only
 * the console knows that. This wrapper is the smallest thing that can hold that
 * one piece of shared state, which keeps it out of a context or a store.
 *
 * On a wide screen they sit side by side, so an operator can read the fab sheet
 * without losing sight of the clock. Below that they stack, timer first.
 */

type Props = {
  initialRuns: FabRun[]
  initialServerNow: string
  initialDocs: FabDocLink[]
}

export default function FabFloorWorkspace({
  initialRuns,
  initialServerNow,
  initialDocs,
}: Props) {
  const [activeProject, setActiveProject] = useState<string | null>(
    initialRuns[0]?.projectNumber ?? null
  )

  // Stable identity, otherwise the console's effect refires on every render.
  const handleProjectChange = useCallback((projectNumber: string | null) => {
    setActiveProject(projectNumber)
  }, [])

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
      <FabRunConsole
        initialRuns={initialRuns}
        initialServerNow={initialServerNow}
        onActiveProjectChange={handleProjectChange}
      />
      <FabDocsPanel projectNumber={activeProject} initialDocs={initialDocs} />
    </div>
  )
}
