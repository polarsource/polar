'use client'

import { schemas } from '@polar-sh/client'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

export type CompassTab = 'assistant' | 'insights'

/**
 * Routed tabs for the Compass subpages: the assistant conversation and the
 * full insights feed are separate routes, so each is deep-linkable and the
 * browser back button behaves.
 */
export const CompassTabs = ({
  organization,
  active,
}: {
  organization: schemas['Organization']
  active: CompassTab
}) => {
  const router = useRouter()
  const base = `/dashboard/${organization.slug}/compass`

  return (
    <Tabs
      value={active}
      onValueChange={(value) =>
        router.push(value === 'insights' ? `${base}/insights` : base)
      }
    >
      <TabsList>
        <TabsTrigger value="assistant">Assistant</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
