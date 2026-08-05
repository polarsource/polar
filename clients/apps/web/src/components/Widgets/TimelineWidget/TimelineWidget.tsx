'use client'

import { Timeline } from '@/components/Timeline/Timeline'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { SegmentedControl } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { WidgetContainer } from '../WidgetContainer'
import { WidgetGuard } from '../WidgetGuard'

const WIDGET_TITLE = 'Timeline'

type SourceFilter = 'system' | 'all'

export interface TimelineWidgetProps {
  className?: string
}

export const TimelineWidget = ({ className }: TimelineWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={twMerge('min-h-80', className)}
  >
    <TimelineWidgetContent className={className} />
  </WidgetGuard>
)

const TimelineWidgetContent = ({ className }: TimelineWidgetProps) => {
  const { organization: org } = useContext(OrganizationContext)
  const [source, setSource] = useState<SourceFilter>('system')

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      action={
        <SegmentedControl<SourceFilter>
          size="sm"
          options={[
            { value: 'system', label: 'System' },
            { value: 'all', label: 'All' },
          ]}
          value={source}
          onChange={setSource}
        />
      }
      className={twMerge('min-h-80', className)}
    >
      <Box flexDirection="column" flex={1} paddingBottom="xl">
        <Timeline
          organizationId={org.id}
          organizationSlug={org.slug}
          source={source === 'system' ? 'system' : undefined}
          viewAllHref={`/dashboard/${org.slug}/analytics/events`}
          emptyMessage="Events from your organization will appear here."
        />
      </Box>
    </WidgetContainer>
  )
}
