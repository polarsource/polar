'use client'

import { SegmentedControl } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

export type ExplorerMode = 'events' | 'costs'

const OPTIONS: { value: ExplorerMode; label: string }[] = [
  { value: 'events', label: 'Events' },
  { value: 'costs', label: 'Costs' },
]

export const explorerPath = (organizationSlug: string, mode: ExplorerMode) =>
  `/dashboard/${organizationSlug}/analytics/events${mode === 'costs' ? '/costs' : ''}`

// Events and Costs are two modes of one explorer. Switching keeps the
// customer filter, the only filter both modes share.
export const ExplorerModeSwitch = ({
  organizationSlug,
  mode,
  customerIds,
}: {
  organizationSlug: string
  mode: ExplorerMode
  customerIds: string[] | null
}) => {
  const router = useRouter()

  return (
    <SegmentedControl<ExplorerMode>
      className="w-full [&>*]:flex-1"
      options={OPTIONS}
      value={mode}
      onChange={(next) => {
        if (next === mode) return
        const query =
          customerIds && customerIds.length > 0
            ? `?${new URLSearchParams({ customerIds: customerIds.join(',') })}`
            : ''
        router.push(`${explorerPath(organizationSlug, next)}${query}`)
      }}
    />
  )
}
