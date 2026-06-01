'use client'

import { InsightsWidget } from '@/components/Insights/InsightsWidget'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface InsightsPageProps {
  organization: schemas['Organization']
}

export default function InsightsPage({ organization }: InsightsPageProps) {
  return (
    <DashboardBody
      title="Insights"
      header={
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Text color="muted">
            Auto-generated highlights about your business. Updated weekly.
          </Text>
        </Box>
      }
      wrapperClassName="max-w-(--breakpoint-md)!"
    >
      <Box display="flex" flexDirection="column" rowGap="2xl">
        <InsightsWidget organization={organization} hideHeader />
      </Box>
    </DashboardBody>
  )
}
