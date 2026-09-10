'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useContext, useMemo } from 'react'
import { getVoidData } from './mock'
import { VoidMetricGrid } from './VoidMetricGrid'
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
    <Box alignItems="baseline" justifyContent="between" columnGap="l">
      <Text variant="heading-xs" as="h2">
        {title}
      </Text>
      {caption ? (
        <Text color="muted" variant="body">
          {caption}
        </Text>
      ) : null}
    </Box>
    {children}
  </Box>
)

export const VoidHome = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const data = useMemo(() => getVoidData(), [])

  return (
    <DashboardBody className="gap-y-8 md:gap-y-16" title={null}>
      <Section title="Overview" caption="Last 30 days">
        <VoidMetricGrid
          data={data.metrics}
          previousData={data.previousMetrics}
        />
      </Section>
      <Section title="Identities">
        <VoidToplists data={data} base={base} />
      </Section>
      <Section title="Definition">
        <VoidWidgets data={data} base={base} />
      </Section>
    </DashboardBody>
  )
}
