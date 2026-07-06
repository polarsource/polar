'use client'

import { CompassWidget } from '@/components/Compass/CompassWidget'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface CompassPageProps {
  organization: schemas['Organization']
}

export default function CompassPage({ organization }: CompassPageProps) {
  return (
    <DashboardBody
      title="Compass"
      header={
        <Box display="flex" flexDirection="column" rowGap="xs">
          <Text color="muted">
            Auto-generated highlights, computed live from your latest metrics.
          </Text>
        </Box>
      }
      wrapperClassName="max-w-(--breakpoint-md)!"
    >
      <Box display="flex" flexDirection="column" rowGap="2xl">
        <CompassWidget organization={organization} hideHeader layout="column" />
      </Box>
    </DashboardBody>
  )
}
