'use client'

import { computeCumulativeValue } from '@/utils/metrics'
import { Search } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { useState } from 'react'
import { CustomerMeter } from '../Customer/CustomerMeter'
import DateRangePicker from '../Metrics/DateRangePicker'
import IntervalPicker from '../Metrics/IntervalPicker'

const mockedMeters = (organizationId: string): schemas['Meter'][] => [
  {
    id: '1',
    name: 'CPU',
    filter: {
      conjunction: 'and',
      clauses: [],
    },
    aggregation: {
      func: 'sum',
      property: 'value',
    },
    metadata: {},
    created_at: '2021-01-01',
    modified_at: '2021-01-01',
    organization_id: organizationId,
  },
  {
    id: '2',
    name: 'Memory',
    filter: {
      conjunction: 'and',
      clauses: [],
    },
    aggregation: {
      func: 'sum',
      property: 'value',
    },
    metadata: {},
    created_at: '2021-01-01',
    modified_at: '2021-01-01',
    organization_id: organizationId,
  },
  {
    id: '3',
    name: 'Storage',
    filter: {
      conjunction: 'and',
      clauses: [],
    },
    aggregation: {
      func: 'sum',
      property: 'value',
    },
    metadata: {},
    created_at: '2021-01-01',
    modified_at: '2021-01-01',
    organization_id: organizationId,
  },
]

const mockedEvents = (organizationId: string): schemas['Event'][] => [
  {
    id: '1',
    organization_id: organizationId,
    timestamp: '2021-01-01',
    metadata: {
      value: 100,
    },
    name: 'CPU',
    source: 'system',
    customer_id: null,
    customer: null,
    external_customer_id: null,
  },
  {
    id: '2',
    organization_id: organizationId,
    timestamp: '2021-01-02',
    metadata: {
      value: 200,
    },
    name: 'CPU',
    source: 'system',
    customer_id: null,
    customer: null,
    external_customer_id: null,
  },
  {
    id: '3',
    organization_id: organizationId,
    timestamp: '2021-01-03',
    metadata: { value: 130 },
    name: 'CPU',
    source: 'system',
    customer_id: null,
    customer: null,
    external_customer_id: null,
  },
]

const mockedAlerts = (organizationId: string) => [
  {
    id: '1',
    organization_id: organizationId,
    meter: mockedMeters(organizationId)[0],
    threshold: 100,
  },
  {
    id: '2',
    organization_id: organizationId,
    meter: mockedMeters(organizationId)[1],
    threshold: 200,
  },
]

export interface CustomerUsageProps {
  organizationId: string
}

export const CustomerUsage = ({ organizationId }: CustomerUsageProps) => {
  const [interval, setInterval] = useState<
    'hour' | 'day' | 'week' | 'month' | 'year'
  >('week')
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: new Date(),
  })

  return (
    <div className="flex flex-col">
      <Tabs defaultValue="meters">
        <div className="flex flex-row items-center justify-between gap-x-12">
          <h3 className="text-2xl">Usage</h3>
          <TabsList>
            <TabsTrigger value="meters">Meters</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent className="flex flex-col gap-y-12 pt-8" value="meters">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 lg:flex-row">
              <div className="w-full">
                <Input
                  preSlot={<Search fontSize="inherit" />}
                  placeholder="Search Usage Meter"
                />
              </div>
              <div className="w-full lg:w-auto">
                <IntervalPicker interval={interval} onChange={setInterval} />
              </div>
              <div className="w-full lg:w-auto">
                <DateRangePicker
                  date={dateRange}
                  onDateChange={setDateRange}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h3 className="text-xl">Overview</h3>
            <DataTable
              isLoading={false}
              columns={[
                {
                  header: 'Name',
                  accessorKey: 'name',
                  cell: ({ row }) => {
                    return (
                      <div className="flex items-center gap-2">
                        <div className="relative h-3 w-3">
                          <div className="absolute h-full w-full rounded-full border-2 border-gray-200 dark:border-gray-700" />
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
                        <span>{row.original.name}</span>
                      </div>
                    )
                  },
                },
                {
                  header: 'Value',
                  accessorKey: 'value',
                  cell: ({ row }) => {
                    return (
                      <span>
                        {computeCumulativeValue(
                          {
                            slug: 'quantity',
                            display_name: 'Quantity',
                            type: 'scalar',
                          },
                          mockedEvents(organizationId).map((e) =>
                            Number(e.metadata.value),
                          ) ?? [],
                        )}
                      </span>
                    )
                  },
                },
                {
                  header: 'Included',
                  accessorKey: 'included',
                  cell: ({ row }) => {
                    return (
                      <span>
                        {' '}
                        {computeCumulativeValue(
                          {
                            slug: 'quantity',
                            display_name: 'Quantity',
                            type: 'scalar',
                          },
                          mockedEvents(organizationId).map((e) =>
                            Number(e.metadata.value),
                          ) ?? [],
                        )}{' '}
                        / 20K
                      </span>
                    )
                  },
                },
                {
                  header: 'Overage',
                  accessorKey: 'overage',
                  cell: ({ row }) => {
                    return <span>$0.00</span>
                  },
                },
              ]}
              data={mockedMeters(organizationId)}
            />
          </div>

          {mockedMeters(organizationId).map((meter) => (
            <CustomerMeter
              key={meter.id}
              meter={meter}
              data={{
                quantities: mockedEvents(organizationId).map((event) => ({
                  timestamp: new Date(event.timestamp),
                  quantity: Number(event.metadata.value),
                })),
              }}
            />
          ))}
        </TabsContent>
        <TabsContent value="alerts" className="flex flex-col gap-y-12">
          <DataTable
            isLoading={false}
            columns={[
              {
                header: 'Meter',
                accessorKey: 'meter',
                cell: ({ row }) => {
                  return <span>{row.original.meter.name}</span>
                },
              },
              {
                header: 'Threshold',
                accessorKey: 'threshold',
                cell: ({ row }) => {
                  return <span>{row.original.threshold}</span>
                },
              },
              {
                header: 'Progress',
                accessorKey: 'progress',
                cell: ({ row }) => {
                  return (
                    <div className="flex flex-row items-center gap-2">
                      <div className="relative h-3 w-3">
                        <div className="absolute h-full w-full rounded-full border-2 border-gray-200 dark:border-gray-700" />
                        <div
                          className="absolute h-full w-full rounded-full border-2 border-blue-500"
                          style={{
                            clipPath: `polygon(0 0, ${(row.original.threshold / 100) * 100}% 0, ${(row.original.threshold / 100) * 100}% 100%, 0% 100%)`,
                            transform: 'rotate(-90deg)',
                            transition: 'all 0.3s ease',
                          }}
                        />
                      </div>
                      <span>{(row.original.threshold / 100) * 100}%</span>
                    </div>
                  )
                },
              },
              {
                header: 'Status',
                accessorKey: 'status',
                cell: ({ row }) => {
                  return (
                    <Status
                      status="Notified"
                      className="w-fit bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
                    />
                  )
                },
              },
            ]}
            data={mockedAlerts(organizationId)}
          />
          <Button className="self-start">Create Alert</Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
