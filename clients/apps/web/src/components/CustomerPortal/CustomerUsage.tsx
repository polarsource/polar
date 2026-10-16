'use client'

import { useCustomerCustomerMeters } from '@/hooks/queries/customerPortal'
import Search from '@mui/icons-material/Search'
import { Client, schemas } from '@polar-sh/client'
import { Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
import {
  PortalCard,
  PortalEmptyState,
  PortalPageHeader,
  PortalRow,
  PortalRows,
  PortalText,
} from './PortalPrimitives'

export interface CustomerUsageProps {
  api: Client
}

const MeterCard = ({
  customerMeter,
}: {
  customerMeter: schemas['CustomerCustomerMeter']
}) => {
  const { meter, consumed_units, credited_units, balance } = customerMeter
  const consumedRatio =
    credited_units > 0 ? Math.min(consumed_units / credited_units, 1) : null

  return (
    <PortalCard>
      <Box flexDirection="column" rowGap="xs">
        <PortalText tone="secondary" className="truncate text-sm">
          {meter.name}
        </PortalText>
        <Text variant="heading-xs" as="p" tabularNums>
          <FormattedUnits value={balance} />
        </Text>
        <PortalText tone="tertiary" className="text-xs">
          Remaining balance
        </PortalText>
      </Box>
      {consumedRatio !== null && (
        <Box
          height={4}
          width="100%"
          borderRadius="full"
          overflow="hidden"
          backgroundColor="background-card"
        >
          <Box
            height="100%"
            borderRadius="full"
            backgroundColor="background-inverse"
            width={`${consumedRatio * 100}%`}
          />
        </Box>
      )}
      <PortalRows>
        <PortalRow
          numeric
          label="Consumed"
          value={<FormattedUnits value={consumed_units} />}
        />
        <PortalRow
          numeric
          label="Credited"
          value={<FormattedUnits value={credited_units} />}
        />
      </PortalRows>
    </PortalCard>
  )
}

export const CustomerUsage = ({ api }: CustomerUsageProps) => {
  const [query, setQuery] = useState<string | null>(null)
  const { data, isLoading } = useCustomerCustomerMeters(api, { query })
  const customerMeters = useMemo(() => data?.items ?? [], [data])

  return (
    <>
      <PortalPageHeader
        title="Usage"
        description="Consumption and remaining balance per meter"
      />
      <Box flexDirection="column" rowGap="l">
        <Input
          preSlot={<Search fontSize="inherit" />}
          placeholder="Search meters"
          value={query || ''}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isLoading ? (
          <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="s">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse">
                <Box
                  height={180}
                  borderRadius="l"
                  backgroundColor="background-secondary"
                />
              </div>
            ))}
          </Grid>
        ) : customerMeters.length > 0 ? (
          <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="s">
            {customerMeters.map((customerMeter) => (
              <MeterCard key={customerMeter.id} customerMeter={customerMeter} />
            ))}
          </Grid>
        ) : (
          <PortalEmptyState
            title="No usage yet"
            description={
              query
                ? 'No meters match your search.'
                : 'Usage will appear here once you start consuming metered features.'
            }
          />
        )}
      </Box>
    </>
  )
}
