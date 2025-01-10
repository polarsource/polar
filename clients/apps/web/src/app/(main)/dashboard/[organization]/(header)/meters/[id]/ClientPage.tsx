'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMeter } from '@/hooks/queries/meters'
import { Organization } from '@polar-sh/sdk'
import { useParams } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { DataTable } from 'polarkit/components/ui/atoms/datatable'
import { Status } from 'polarkit/components/ui/atoms/Status'
import { Separator } from 'polarkit/components/ui/separator'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

function MeterDetail({
  label,
  value,
  valueClassName = '',
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex flex-row items-baseline justify-between gap-x-4 text-sm">
      <h3 className="dark:text-polar-500 flex-1 text-gray-500">{label}</h3>
      <span
        className={twMerge(
          'dark:hover:bg-polar-800 flex-1 rounded-md px-2 py-1.5 transition-colors duration-75 hover:bg-gray-100',
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  )
}

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const { id } = useParams()
  const { data: meter } = useMeter(id as string)

  const ContextView = useCallback(() => {
    if (!meter) return null

    return (
      <div className="flex flex-col gap-y-6 p-10">
        <div className="flex flex-row gap-x-2">
          <h2 className="text-xl">Details</h2>
        </div>
        <Separator />
        <div className="flex flex-col">
          <MeterDetail label="Meter ID" value={meter.id} />
          <MeterDetail
            label="Meter Created"
            value={<FormattedDateTime datetime={meter.created_at} />}
          />
          <MeterDetail
            label="Meter Last Updated"
            value={<FormattedDateTime datetime={meter.updated_at} />}
          />
          <MeterDetail label="Name" value={meter.name} />
          <MeterDetail
            label="Slug"
            value={meter.slug}
            valueClassName="font-mono text-sm"
          />
          <MeterDetail
            label="Aggregation Type"
            value={meter.aggregation_type}
            valueClassName="capitalize"
          />
        </div>
      </div>
    )
  }, [meter])

  const mockedEvents = [
    {
      value: 12430,
      customer: 'Emil Widlund',
      timestamp: '2024-01-01T00:00:00Z',
    },
    { value: 202340, customer: 'Joe Doe', timestamp: '2024-01-02T00:00:00Z' },
    { value: 523, customer: 'Jane Doe', timestamp: '2024-01-03T00:00:00Z' },
  ]

  if (!meter) return null

  return (
    <DashboardBody
      className="flex flex-col gap-y-12"
      title={
        <div className="flex flex-row items-center gap-x-4">
          <h1 className="text-2xl">{meter.name}</h1>
          <Status
            className={twMerge(
              'w-fit capitalize',
              meter?.status === 'active'
                ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950'
                : 'bg-red-100 text-red-500 dark:bg-red-950',
            )}
            status={meter?.status}
          />
        </div>
      }
      header={
        <div className="flex flex-row gap-x-4">
          <Button variant="secondary">Edit Meter</Button>
          <Button>Add Usage</Button>
        </div>
      }
      contextView={<ContextView />}
    >
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-xl">Activity</h2>
        </div>
        <div className="flex flex-row gap-x-8">
          <Card className="flex-1 rounded-3xl">
            <CardHeader>
              <span className="dark:text-polar-500 text-gray-500">
                Previous Period
              </span>
            </CardHeader>
            <CardContent>
              <span className="text-4xl">0</span>
            </CardContent>
            <CardFooter>
              <span className="dark:text-polar-500 text-gray-500">
                {new Date(
                  new Date().setMonth(new Date().getMonth() - 1, 1),
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date(new Date().setDate(0)).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </CardFooter>
          </Card>
          <Card className="flex-1 rounded-3xl">
            <CardHeader>
              <span className="dark:text-polar-500 text-gray-500">
                Current Period
              </span>
            </CardHeader>
            <CardContent>
              <span className="text-4xl">
                {Intl.NumberFormat('en-US', { notation: 'standard' }).format(
                  meter.value,
                )}
              </span>
            </CardContent>
            <CardFooter>
              <span className="dark:text-polar-500 text-gray-500">
                {new Date(new Date().setDate(1)).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
      <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-6">
        <h2 className="text-lg font-semibold">Get started with metering</h2>
        <p>Meter usage by sending meter events to the Polar API.</p>
        <pre className="dark:bg-polar-900 rounded-lg bg-white p-4 font-mono text-sm">
          <code>{`curl https://api.polar.sh/v1/billing/meter_events \\
  -u "sk_test_...:gHzA" \\
  -d slug=${meter.slug} \\
  -d timestamp=1736464874 \\
  -d "payload[customer_id]"="{{ CUSTOMER_ID }}" \\
  -d "payload[value]"=1`}</code>
        </pre>
      </div>
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <h3 className="text-xl">Latest meter events</h3>
          <p className="dark:text-polar-500 text-gray-500">
            Sample events that were recently received.
          </p>
        </div>
        <DataTable
          columns={[
            { header: 'Customer', accessorKey: 'customer' },
            {
              header: 'Value',
              accessorKey: 'value',
              cell: ({ row }) => (
                <span className="font-mono text-sm">
                  {Intl.NumberFormat('en-US', { notation: 'standard' }).format(
                    row.original.value,
                  )}
                </span>
              ),
            },
            {
              header: 'Timestamp',
              accessorKey: 'timestamp',
              cell: ({ row }) => (
                <FormattedDateTime datetime={row.original.timestamp} />
              ),
            },
          ]}
          data={mockedEvents}
          isLoading={false}
        />
      </div>
    </DashboardBody>
  )
}
