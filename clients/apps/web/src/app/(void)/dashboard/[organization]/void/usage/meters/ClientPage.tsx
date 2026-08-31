'use client'

import { VoidCell, VoidGrid } from '@/components/Void/VoidGrid'
import { VoidMeterCell } from '@/components/Void/VoidMeterCell'
import { VoidSection } from '@/components/Void/VoidSection'
import { useMeters } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { useContext, useMemo } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const { data } = useMeters(organization.id, {
    limit: 12,
    is_archived: false,
  })

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    return { startDate: subDays(end, 29), endDate: end }
  }, [])

  const meters = data?.items ?? []

  return (
    <Box as="main" flexDirection="column" paddingTop="5xl" flexGrow={1}>
      <VoidSection
        label="Usage"
        meta={`${meters.length} meters running / 30 days`}
      >
        <VoidGrid>
          {meters.length > 0 ? (
            meters.map((meter) => (
              <VoidMeterCell
                key={meter.id}
                meter={meter}
                startDate={startDate}
                endDate={endDate}
              />
            ))
          ) : (
            <VoidCell colSpan={{ base: 1, md: 2, lg: 4 }}>
              <Box flexDirection="column" rowGap="s" paddingVertical="2xl">
                <Text variant="heading-m" color="muted">
                  No meters running
                </Text>
                <Text variant="heading-xxs" color="muted">
                  Push a billing definition to deploy your first meter
                </Text>
              </Box>
            </VoidCell>
          )}
        </VoidGrid>
      </VoidSection>
    </Box>
  )
}
