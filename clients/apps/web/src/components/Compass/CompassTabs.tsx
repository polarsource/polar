'use client'

import { schemas } from '@polar-sh/client'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import { useCompassBase } from './useCompassBase'

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
  const compassBase = useCompassBase(organization)
  const router = useRouter()

  return (
    <Tabs
      value={active}
      onValueChange={(value) =>
        router.push(
          value === 'insights' ? `${compassBase}/insights` : compassBase,
        )
      }
    >
      <TabsList>
        <TabsTrigger value="assistant">Assistant</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
