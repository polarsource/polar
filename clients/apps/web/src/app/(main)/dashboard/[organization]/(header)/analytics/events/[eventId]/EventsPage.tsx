'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { EventRow } from '@/components/Events/EventRow'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventTypes } from '@/hooks/queries/event_types'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  useEvent,
  useEventVarianceStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import React, { useMemo } from 'react'

const PAGE_SIZE = 50

interface EventDetailPageProps {
  organization: schemas['Organization']
  eventId: string
}

export default function EventDetailPage({
  organization,
  eventId,
}: EventDetailPageProps) {
  const { data: event } = useEvent(organization.id, eventId, {
    aggregate_fields: ['_cost.amount'],
  })

  const varianceDateParams = useMemo(() => {
    if (!event) return null
    const eventDate = new Date(event.timestamp)
    const startDate = new Date(eventDate)
    startDate.setDate(startDate.getDate() - 30)
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: eventDate.toISOString().split('T')[0],
      aggregate_fields: ['_cost.amount'],
    }
  }, [event])

  const { data: varianceStats } = useEventVarianceStats(
    organization.id,
    varianceDateParams ?? { start_date: '', end_date: '' },
    !!varianceDateParams,
  )

  const anomaly = useMemo(
    () => varianceStats?.items.find((s) => s.event_id === eventId) ?? null,
    [varianceStats, eventId],
  )

  const anomalyStats = useMemo(() => {
    if (!anomaly) return null
    const value = parseFloat(String(anomaly.values?.['_cost_amount'] ?? '0'))
    const avg = parseFloat(String(anomaly.averages?.['_cost_amount'] ?? '0'))
    const p99 = parseFloat(String(anomaly.p99?.['_cost_amount'] ?? '0'))
    const multiplier = avg > 0 ? value / avg : null
    const excessAboveP99 = value - p99
    return { value, avg, p99, multiplier, excessAboveP99 }
  }, [anomaly])

  const {
    data: childrenData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    parent_id: eventId,
    limit: PAGE_SIZE,
    sorting: ['timestamp'],
    depth: 1,
  })

  const children = useMemo(() => {
    if (!childrenData) return []
    return childrenData.pages.flatMap((page) => page.items)
  }, [childrenData])

  const { data: eventTypesData } = useEventTypes(
    organization.id,
    { query: event?.label, limit: 1 },
    !!event,
  )
  const eventTypeId = eventTypesData?.items?.[0]?.id ?? null

  if (!event) {
    return null
  }

  return (
    <DashboardBody
      title={
        <div className="flex flex-col gap-y-6">
          {event.parent_id ? (
            <Link
              href={`/dashboard/${organization.slug}/analytics/events/${event.parent_id}`}
              className="flex w-fit flex-row items-center gap-x-4 text-sm"
            >
              <Button
                variant="secondary"
                size="sm"
                className="aspect-square size-6 rounded-md"
              >
                <KeyboardArrowUpOutlined className="h-2 w-2" />
              </Button>
              <span>Parent Event</span>
            </Link>
          ) : (
            <span>Event</span>
          )}
        </div>
      }
      className="flex flex-col gap-y-12"
      contextViewPlacement="right"
      contextView={
        event.customer ? (
          <CustomerContextView
            organization={organization}
            customer={event.customer}
          />
        ) : undefined
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none md:block hidden md:shadow-none"
    >
      <div className="grid grid-cols-1 items-start gap-16 md:grid-cols-[1fr_360px]">
        {/* Left column — event rows */}
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row items-center justify-between gap-x-4">
            <h3 className="text-4xl">{event.label}</h3>
            {'_cost' in event.metadata && event.metadata._cost && (
              <h3 className="dark:text-polar-500 font-mono text-4xl text-gray-400">
                {formatCurrency('subcent')(
                  Number(event.metadata._cost?.amount ?? 0),
                  event.metadata._cost?.currency ?? 'usd',
                )}
              </h3>
            )}
          </div>
          <div className="flex flex-col gap-y-1">
            <EventRow
              event={event}
              organization={organization}
              expanded={true}
              depth={0}
              renderChildren={false}
              renderEventLink={false}
            />
          </div>
          {children.length > 0 && (
            <div className="flex flex-col gap-y-8">
              <div className="flex flex-row justify-between">
                <h3 className="text-2xl">Child Events</h3>
                <h3 className="dark:text-polar-500 text-2xl text-gray-400">
                  {children.length} {children.length === 1 ? 'Event' : 'Events'}
                </h3>
              </div>
              <div className="flex flex-col gap-y-1">
                {children.map((child) => (
                  <EventRow
                    key={child.id}
                    event={child}
                    organization={organization}
                    expanded
                    renderChildren={false}
                  />
                ))}
                {hasNextPage && (
                  <Button
                    className="self-start"
                    variant="secondary"
                    onClick={() => fetchNextPage()}
                    loading={isFetching}
                  >
                    Load More
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column — insights */}
        <div className="flex flex-col gap-y-5">
          <Field label="Timestamp">
            <span className="font-mono text-sm capitalize dark:text-white">
              {new Date(event.timestamp).toLocaleDateString('en-US', {
                hour: '2-digit',
                minute: 'numeric',
                second: 'numeric',
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })}
            </span>
          </Field>
          <Field label="Event Type">
            <div className="flex flex-col gap-y-2">
              <span className="text-sm dark:text-white">{event.label}</span>
              <div className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-xs text-gray-400">
                <Link
                  href={`/dashboard/${organization.slug}/analytics/events?eventTypes=${encodeURIComponent(event.name)}`}
                  className="hover:dark:text-polar-300 hover:text-gray-600"
                >
                  View Events
                </Link>
                {eventTypeId && (
                  <>
                    <span>·</span>
                    <Link
                      href={`/dashboard/${organization.slug}/analytics/costs/${eventTypeId}`}
                      className="hover:dark:text-polar-300 hover:text-gray-600"
                    >
                      View Cost Span
                    </Link>
                  </>
                )}
              </div>
            </div>
          </Field>
          {event.customer && (
            <Field label="Customer">
              <Link
                href={`/dashboard/${organization.slug}/customers/${event.customer.id}`}
                className="dark:hover:bg-polar-800 -mx-2 flex flex-row items-center gap-x-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
              >
                <Avatar
                  avatar_url={event.customer.avatar_url}
                  name={event.customer.name || event.customer.email || '—'}
                  className="size-8 text-xs"
                />
                <div className="flex flex-col">
                  {event.customer.name && (
                    <span className="text-sm dark:text-white">
                      {event.customer.name}
                    </span>
                  )}
                  {event.customer.email && (
                    <span className="dark:text-polar-400 text-xs text-gray-500">
                      {event.customer.email}
                    </span>
                  )}
                </div>
              </Link>
            </Field>
          )}
          {anomaly && anomalyStats && (
            <Field
              label={
                <span className="flex items-center gap-1.5 text-gray-900 dark:text-white">
                  <AlertTriangle className="size-3 text-red-500" />
                  <span>Cost Anomaly</span>
                </span>
              }
            >
              <div className="flex flex-col gap-y-3">
                <span className="dark:text-polar-400 text-xs text-gray-500">
                  Compared to {anomaly.name} events in the last 30 days
                </span>
                <div className="dark:border-polar-700 flex overflow-hidden rounded-lg border border-gray-200">
                  <div className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2">
                    <span className="dark:text-polar-400 text-xs text-gray-500">
                      Avg
                    </span>
                    <span className="font-mono text-sm tabular-nums dark:text-white">
                      {formatCurrency('subcent')(anomalyStats.avg, 'usd')}
                    </span>
                  </div>
                  <div className="dark:bg-polar-700 w-px bg-gray-200" />
                  <div className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2">
                    <span className="text-xs text-red-500">Event</span>
                    <span className="font-mono text-sm text-red-500 tabular-nums">
                      {formatCurrency('subcent')(anomalyStats.value, 'usd')}
                    </span>
                  </div>
                  <div className="dark:bg-polar-700 w-px bg-gray-200" />
                  <div className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2">
                    <span className="dark:text-polar-400 text-xs text-gray-500">
                      p99
                    </span>
                    <span className="font-mono text-sm tabular-nums dark:text-white">
                      {formatCurrency('subcent')(anomalyStats.p99, 'usd')}
                    </span>
                  </div>
                </div>
              </div>
            </Field>
          )}
        </div>
      </div>
    </DashboardBody>
  )
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="dark:border-polar-700 flex flex-col gap-y-1 border-t border-gray-200 pt-4 first:border-none first:pt-0">
      <span className="dark:text-polar-500 flex items-center gap-1 text-sm text-gray-400">
        {label}
      </span>
      {children}
    </div>
  )
}
