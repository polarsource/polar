'use client'

import { useCustomerCustomerMeters } from '@/hooks/queries'
import Search from '@mui/icons-material/Search'
import { Client } from '@polar-sh/client'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Tabs, TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
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
    <div className="flex flex-col">
      <Tabs defaultValue="meters">
        <div className="flex flex-row items-center justify-between gap-x-12">
          <h3 className="text-2xl">Usage</h3>
        </div>
        <TabsContent className="flex flex-col gap-y-12 pt-4" value="meters">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 lg:flex-row">
              <div className="w-full lg:w-1/3">
                <Input
                  className="w-full bg-white shadow-xs"
                  preSlot={<Search fontSize="inherit" />}
                  placeholder="Search Usage Meter"
                  value={query || ''}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h3 className="text-xl">Overview</h3>
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
                      <div className="flex items-center gap-2">
                        <div className="relative h-3 w-3">
                          <div className="dark:border-polar-700 absolute h-full w-full rounded-full border-2 border-gray-200" />
                          <div
                            className="absolute h-full w-full rounded-full border-2 border-blue-500"
                            style={{
                              clipPath:
                                'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
                              transform: 'rotate(-90deg)',
                              transition: 'all 0.3s ease',
                            }}
                          />
                        </div>
                        <span>{meter.name}</span>
                      </div>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
