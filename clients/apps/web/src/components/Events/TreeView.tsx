'use client'

import { schemas } from '@polar-sh/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { TreeNode } from './TreeNode'

interface TreeViewProps {
  rootEvent: schemas['Event']
  childEvents: schemas['Event'][]
  organization: schemas['Organization']
}

export const TreeView = ({
  rootEvent,
  childEvents,
  organization,
}: TreeViewProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleEventClick = useCallback(
    (eventId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('event', eventId)
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  return (
    <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-col rounded-2xl border border-gray-200 bg-white p-4">
      <TreeNode
        event={rootEvent}
        organization={organization}
        depth={0}
        childEvents={childEvents}
        onEventClick={handleEventClick}
      />
    </div>
  )
}
