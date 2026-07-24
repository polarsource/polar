'use client'

import { useCustomerCustomerMeters } from '@/hooks/queries/customerPortal'
import Search from '@mui/icons-material/Search'
import { Client } from '@polar-sh/client'
import { DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Input } from '@polar-sh/orbit'
import { Tabs, TabsContent } from '@polar-sh/orbit'
import { useMemo, useState } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
export interface CustomerUsageProps {
  api: Client
}

export const CustomerUsage = ({ api }: CustomerUsageProps) => {
  const [query, setQuery] = useState<string | null>(null)
  const { data, isLoading } = useCustomerCustomerMeters(api, { query })
  const customerMeters = useMemo(() => data?.items ?? [], [data])

  return (
    <Box flexDirection="column">
      <Tabs defaultValue="meters">
        <Box alignItems="center" justifyContent="between" columnGap="3xl">
          <Text variant="heading-s" as="h3">
            Usage
          </Text>
        </Box>
        <TabsContent className="flex flex-col gap-y-12 pt-4" value="meters">
          <Box
            width={{ base: '100%', lg: '33%' }}
            flexDirection="column"
            alignItems="center"
          >
            <Input
              preSlot={<Search fontSize="inherit" />}
              placeholder="Search usage meter"
              value={query || ''}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Box>

          <Box flexDirection="column" rowGap="xl">
            <Text variant="heading-xs" as="h3">
              Overview
            </Text>
            <DataTable
              isLoading={isLoading}
              columns={[
                {
                  header: 'Name',
                  accessorKey: 'meter_name',
                  cell: ({
                    row: {
                      original: { meter },
                    },
                  }) => {
                    return (
                      <Box alignItems="center" columnGap="s">
                        <Box position="relative" width={12} height={12}>
                          <Box
                            position="absolute"
                            width="100%"
                            height="100%"
                            borderRadius="full"
                            borderWidth={2}
                            borderStyle="solid"
                            borderColor="border-primary"
                          />
                        </Box>
                        <Text as="span">{meter.name}</Text>
                      </Box>
                    )
                  },
                },
                {
                  header: 'Consumed',
                  accessorKey: 'consumed_units',
                  cell: ({
                    row: {
                      original: { consumed_units },
                    },
                  }) => {
                    return <FormattedUnits value={consumed_units} />
                  },
                },
                {
                  header: 'Credited',
                  accessorKey: 'credited_units',
                  cell: ({
                    row: {
                      original: { credited_units },
                    },
                  }) => {
                    return <FormattedUnits value={credited_units} />
                  },
                },
                {
                  header: 'Balance',
                  accessorKey: 'balance',
                  cell: ({
                    row: {
                      original: { balance },
                    },
                  }) => {
                    return <FormattedUnits value={balance} />
                  },
                },
              ]}
              data={customerMeters}
            />
          </Box>
        </TabsContent>
      </Tabs>
    </Box>
  )
}
