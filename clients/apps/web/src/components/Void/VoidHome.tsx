'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { useVoidHomeData } from './homeQueries'
import { getVoidData } from './mock'
import { VoidHomeData } from './types'
import { VoidMetricGrid } from './VoidMetricGrid'
import { VoidErrorBox, VoidSectionHeading } from './VoidShell'
import { VoidToplists } from './VoidToplists'
import { VoidWidgets } from './VoidWidgets'

const Section = ({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="xl">
    <VoidSectionHeading
      title={title}
      caption={caption}
      as="h2"
      variant="heading-xs"
      spread
    />
    {children}
  </Box>
)

export const VoidHome = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const fixtures = useMemo<VoidHomeData>(() => getVoidData(), [])
  const home = useVoidHomeData(organization.id, live)
  const data = live ? home.data : fixtures

  return (
    <DashboardBody className="gap-y-8 md:gap-y-16" title={null}>
      {live && home.error ? (
        <VoidErrorBox message={home.error.message} />
      ) : null}
      <Section title="Overview" caption="Last 30 days">
        {data.metrics && data.previousMetrics ? (
          <VoidMetricGrid
            data={data.metrics}
            previousData={data.previousMetrics}
          />
        ) : (
          <LoadingBox height={400} borderRadius="l" />
        )}
      </Section>
      <Section title="Identities">
        {live && home.loading ? (
          <LoadingBox height={240} borderRadius="m" />
        ) : (
          <VoidToplists data={data} base={base} />
        )}
      </Section>
      <Section title="Definition">
        {live && home.loading ? (
          <LoadingBox height={240} borderRadius="m" />
        ) : (
          <VoidWidgets data={data} base={base} />
        )}
      </Section>
    </DashboardBody>
  )
}
