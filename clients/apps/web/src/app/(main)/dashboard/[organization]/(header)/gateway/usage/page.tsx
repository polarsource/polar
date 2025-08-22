'use client'

import UnitGraph from '@/components/Gateway/UnitGraph'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Well,
  WellContent,
  WellFooter,
  WellHeader,
} from '@/components/Shared/Well'
import { useCustomers } from '@/hooks/queries'
import { useEvents } from '@/hooks/queries/events'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { models } from '@polar-sh/models'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Link from 'next/link'
import { useContext, useMemo } from 'react'

const tiles = [
  {
    title: 'Total Requests',
    value: 100,
    description: 'Total number of requests',
  },
  {
    title: 'Completion Tokens',
    value: 100,
    description: 'Total number of completion tokens',
  },
  {
    title: 'Cost Estimate',
    value: formatCurrencyAndAmount(1238913, 'USD'),
    description: 'Estimated cost of your requests',
  },
  {
    title: 'Credits',
    value: 100,
    description: 'Total number of credits',
  },
]

export default function OverviewPage() {
  const { organization } = useContext(OrganizationContext)
  const { data: customers } = useCustomers(organization.id)

  const { data: events } = useEvents(organization.id, {
    metadata: {
      strategy: 'LLM',
    },
  })

  const customersData = useMemo(
    () =>
      (customers?.pages.flatMap((page) => page.items) ?? []).map(
        (customer) => ({
          ...customer,
          totalRequests: Math.floor(Math.random() * 100000),
          totalTokens: Math.floor(Math.random() * 100000),
          totalCost: formatCurrencyAndAmount(Math.random() * 100000, 'USD'),
        }),
      ),
    [customers],
  )

  const modelsData = useMemo(() => {
    return models.map((model) => ({
      ...model,
      inputTokens: Math.floor(Math.random() * 100000),
      completionTokens: Math.floor(Math.random() * 100000),
      requestCount: Math.floor(Math.random() * 100000),
    }))
  }, [])

  return (
    <DashboardBody className="flex flex-col gap-y-12">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Well
            key={tile.title}
            className="flex flex-col gap-y-2 rounded-2xl p-6"
          >
            <WellHeader>
              <h2 className="text-lg font-medium">{tile.title}</h2>
            </WellHeader>
            <WellContent>
              <p className="text-2xl">{tile.value}</p>
            </WellContent>
            <WellFooter>
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {tile.description}
              </span>
            </WellFooter>
          </Well>
        ))}
      </div>
      <UnitGraph
        height={400}
        revenueData={[
          ...Array.from({ length: 31 }, (_, i) => ({
            timestamp: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
            value: Math.floor(300 * Math.exp(i / 10)), // Starts at 100, grows by 20% each day
          })),
        ]}
        costData={[
          ...Array.from({ length: 31 }, (_, i) => ({
            timestamp: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
            value: Math.floor(500 * Math.exp(Math.sin(i) + 1) * (i / 20)),
          })),
        ]}
        interval="day"
      />
      <Tabs defaultValue="customers">
        <TabsList className="mb-6 p-0">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <DataTable
            columns={[
              {
                header: 'Customer',
                accessorKey: 'email',
                cell: ({ row }) => {
                  return (
                    <Link
                      className="flex items-center gap-x-2"
                      href={`/dashboard/${organization.slug}?query=${row.original.email}`}
                    >
                      <Avatar
                        name={row.original.email}
                        avatar_url={row.original.avatar_url}
                        className="h-8 w-8"
                        loading="lazy"
                      />
                      <span>{row.original.email}</span>
                    </Link>
                  )
                },
              },
              {
                header: 'Total Requests',
                accessorKey: 'totalRequests',
                cell: ({ row }) => {
                  return (
                    <Tooltip>
                      <TooltipTrigger>
                        <span>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(row.original.totalRequests)}
                        </span>
                      </TooltipTrigger>
                    </Tooltip>
                  )
                },
              },

              {
                header: 'Total Tokens',
                accessorKey: 'totalTokens',
                cell: ({ row }) => {
                  return (
                    <Tooltip>
                      <TooltipTrigger>
                        <span>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(row.original.totalTokens)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                          }).format(row.original.totalTokens)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                },
              },

              {
                header: 'Total Cost',
                accessorKey: 'totalCost',
              },
            ]}
            data={customersData}
            isLoading={false}
          />
        </TabsContent>
        <TabsContent value="models">
          <DataTable
            columns={[
              {
                header: 'Model',
                accessorKey: 'model',
              },
              {
                header: 'Provider',
                accessorFn: (row) => row.providers[0].providerId,
              },
              {
                header: 'Input Tokens',
                accessorKey: 'inputTokens',
                cell: ({ row }) => {
                  return (
                    <Tooltip>
                      <TooltipTrigger>
                        <span>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(row.original.inputTokens)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                          }).format(row.original.inputTokens)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                },
              },
              {
                header: 'Completion Tokens',
                accessorKey: 'completionTokens',
                cell: ({ row }) => {
                  return (
                    <Tooltip>
                      <TooltipTrigger>
                        <span>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(row.original.completionTokens)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                          }).format(row.original.completionTokens)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                },
              },
              {
                header: 'Request Count',
                accessorKey: 'requestCount',
                cell: ({ row }) => {
                  return (
                    <Tooltip>
                      <TooltipTrigger>
                        <span>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                            maximumFractionDigits: 0,
                            notation: 'compact',
                          }).format(row.original.requestCount)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {Intl.NumberFormat('en-US', {
                            style: 'decimal',
                          }).format(row.original.requestCount)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                },
              },
            ]}
            data={modelsData}
            isLoading={false}
          />
        </TabsContent>
      </Tabs>
    </DashboardBody>
  )
}
