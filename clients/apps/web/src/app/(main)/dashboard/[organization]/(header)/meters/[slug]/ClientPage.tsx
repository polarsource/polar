'use client'

import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMeter, useMeterEvents } from '@/hooks/queries/meters'
import { AddOutlined, MoreVert } from '@mui/icons-material'
import { MetricType, Organization } from '@polar-sh/sdk'
import { useParams } from 'next/navigation'
import { FormattedDateTime, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { DataTable } from 'polarkit/components/ui/atoms/datatable'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { Status } from 'polarkit/components/ui/atoms/Status'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

const mockedMeterProducts = [
  {
    id: '123',
    name: 'Pro Tier',
  },
  {
    id: '456',
    name: 'Enterprise Tier',
  },
  {
    id: '789',
    name: 'Free Tier',
  },
]

const mockedMeterAlerts = [
  {
    id: '123',
    name: 'Small beginnings',
    threshold: 100,
    frequency: 'once_per_customer',
  },
  {
    id: '456',
    name: 'To the moon',
    threshold: 1000,
    frequency: 'once_per_customer',
  },
] as const

const frequencyDisplayNames: Record<
  (typeof mockedMeterAlerts)[number]['frequency'],
  string
> = {
  once_per_customer: 'Once per customer',
}

function MeterDetail({
  label,
  value,
  valueClassName = '',
  action,
}: {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex flex-row items-baseline justify-between gap-x-4 text-sm">
      <h3 className="dark:text-polar-500 flex-1 text-gray-500">{label}</h3>
      <span
        className={twMerge(
          'dark:hover:bg-polar-800 group flex flex-1 flex-row items-center justify-between gap-x-2 rounded-md px-2.5 py-1 transition-colors duration-75 hover:bg-gray-100',
          valueClassName,
        )}
      >
        {value}
        <span className="opacity-0 group-hover:opacity-100">{action}</span>
      </span>
    </div>
  )
}

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const { slug } = useParams()
  const { data: meter } = useMeter(slug as string)
  const { data: meterEvents } = useMeterEvents(meter?.slug)

  const { resolvedTheme } = useTheme()

  const mockedMeterData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return {
      timestamp: date,
      usage: meterEvents?.items
        .filter((event: MeterEvent) => {
          const eventDate = new Date(event.created_at)
          return eventDate.toDateString() === date.toDateString()
        })
        .reduce((total: number, event: MeterEvent) => total + event.value, 0),
    }
  }).reverse()

  const ContextView = useCallback(() => {
    if (!meter) return null

    return (
      <div className="flex flex-col gap-y-8 overflow-y-auto px-8 py-12">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row gap-x-2">
            <h2 className="text-xl">Details</h2>
          </div>
          <div className="flex flex-col">
            <MeterDetail
              label="ID"
              value={meter.id}
              action={<CopyToClipboardButton text={meter.id} />}
            />
            <MeterDetail
              label="Name"
              value={meter.name}
              action={<CopyToClipboardButton text={meter.name} />}
            />
            <MeterDetail
              label="Slug"
              value={meter.slug}
              action={<CopyToClipboardButton text={meter.slug} />}
            />
            <MeterDetail
              label="Aggregation Type"
              value={meter.aggregation_type}
              valueClassName="capitalize"
            />
            <MeterDetail
              label="Created At"
              value={<FormattedDateTime datetime={meter.created_at} />}
            />
            <MeterDetail
              label="Updated At"
              value={<FormattedDateTime datetime={meter.updated_at} />}
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-x-4">
            <h3>Metered Products</h3>
          </div>
          <List size="small">
            {mockedMeterProducts.map((product) => (
              <ListItem className="text-sm" key={product.id} size="small">
                {product.name}
              </ListItem>
            ))}
          </List>
        </div>
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between gap-x-4">
            <h3>Meter Alerts</h3>
            <Button size="sm" className="h-6 w-6 rounded-full">
              <AddOutlined fontSize="inherit" />
            </Button>
          </div>
          <List size="small">
            {mockedMeterAlerts.map((alert) => (
              <ListItem
                className="justify-between text-sm"
                key={alert.id}
                size="small"
              >
                <div className="flex flex-col">
                  <span>{alert.name}</span>
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {frequencyDisplayNames[alert.frequency]}
                  </span>
                </div>
                <div className="dark:text-polar-500 flex flex-row items-center gap-x-2 text-gray-500">
                  <span className="font-mono text-xs">
                    {Intl.NumberFormat('en-US', {
                      notation: 'standard',
                    }).format(alert.threshold)}
                  </span>
                  <div className="relative h-8 w-8">
                    <svg
                      className="absolute left-0 top-0 h-full w-full -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      {(meter.value / alert.threshold) * 100 >= 100 && (
                        <circle
                          cx="18"
                          cy="18"
                          r="1"
                          fill={
                            (meter.value / alert.threshold) * 100 >= 100
                              ? 'rgb(52, 211, 153)'
                              : 'rgb(96, 165, 250)'
                          }
                        />
                      )}
                      <circle
                        cx="18"
                        cy="18"
                        r="8"
                        strokeWidth="3"
                        fill="none"
                        stroke={
                          resolvedTheme === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.1)'
                        }
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="8"
                        stroke={
                          (meter.value / alert.threshold) * 100 >= 100
                            ? 'rgb(52, 211, 153)'
                            : 'rgb(96, 165, 250)'
                        }
                        strokeDasharray={`${Math.round((meter.value / alert.threshold) * 100)}, 100`}
                        strokeWidth="3"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              </ListItem>
            ))}
          </List>
        </div>
      </div>
    )
  }, [meter])

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
          <Button className="text-lg" size="icon" variant="secondary">
            <MoreVert
              className="dark:text-polar-500 text-gray-500"
              fontSize="inherit"
            />
          </Button>
        </div>
      }
      contextView={<ContextView />}
      contextViewClassName="xl:max-w-[400px]"
    >
      <MeterChart
        data={mockedMeterData}
        interval={Interval.DAY}
        metric={{
          display_name: 'Usage',
          slug: 'usage',
          type: MetricType.SCALAR,
        }}
      />
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-xl">Activity</h2>
        </div>
        <div className="flex flex-row gap-x-8">
          <Card className="dark:border-polar-700 flex-1 rounded-3xl border border-gray-200">
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
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date(new Date().setDate(0)).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </CardFooter>
          </Card>
          <Card className="dark:border-polar-700 flex-1 rounded-3xl border border-gray-200">
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
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date().toLocaleDateString('en-US', {
                  month: 'long',
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
  -d "payload[customer_id]"="{{ CUSTOMER_ID }}" \\
  -d "payload[value]"=1`}</code>
        </pre>
      </div>
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <h3 className="text-xl">Latest meter events</h3>
          <p className="dark:text-polar-500 text-gray-500">
            Recently received meter events
          </p>
        </div>
        <DataTable
          columns={[
            {
              header: 'Customer',
              accessorKey: 'customer',
              cell: ({ row }) => (
                <div className="flex flex-row items-center gap-x-2">
                  <Avatar
                    className="dark:bg-polar-900 text-xxs bg-white"
                    name={'Emil Widlund'}
                    avatar_url={null}
                  />
                  <span>Emil Widlund</span>
                </div>
              ),
            },
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
              header: 'Created At',
              accessorKey: 'created_at',
              cell: ({ row }) => (
                <span className="font-mono text-xs capitalize">
                  <PolarTimeAgo date={new Date(row.original.created_at)} />
                </span>
              ),
            },
          ]}
          data={meterEvents?.items ?? []}
          isLoading={false}
        />
      </div>
    </DashboardBody>
  )
}

import { MeterEvent } from '@/app/api/meter/[slug]/data'
import { getValueFormatter } from '@/utils/metrics'
import * as Plot from '@observablehq/plot'
import { Interval, Metric } from '@polar-sh/sdk'
import * as d3 from 'd3'
import { GeistMono } from 'geist/font/mono'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'

const primaryColor = 'rgb(0 98 255)'
const primaryColorFaded = 'rgba(0, 98, 255, 0.3)'
const gradientId = 'chart-gradient'
const createAreaGradient = (id: string) => {
  // Create a <defs> element
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')

  // Create a <linearGradient> element
  const linearGradient = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'linearGradient',
  )
  linearGradient.setAttribute('id', id)
  linearGradient.setAttribute('gradientTransform', 'rotate(90)')

  // Create the first <stop> element
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
  stop1.setAttribute('offset', '0%')
  stop1.setAttribute('stop-color', primaryColorFaded)
  stop1.setAttribute('stop-opacity', '0.5')

  // Create the second <stop> element
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
  stop2.setAttribute('offset', '100%')
  stop2.setAttribute('stop-color', primaryColorFaded)
  stop2.setAttribute('stop-opacity', '0')

  // Append the <stop> elements to the <linearGradient> element
  linearGradient.appendChild(stop1)
  linearGradient.appendChild(stop2)

  // Append the <linearGradient> element to the <defs> element
  defs.appendChild(linearGradient)

  return defs
}

class Callback extends Plot.Dot {
  private callbackFunction: (index: number | undefined) => void

  public constructor(
    data: Plot.Data,
    options: Plot.DotOptions,
    callbackFunction: (data: any) => void,
  ) {
    // @ts-ignore
    super(data, options)
    this.callbackFunction = callbackFunction
  }

  // @ts-ignore
  public render(
    index: number[],
    _scales: Plot.ScaleFunctions,
    _values: Plot.ChannelValues,
    _dimensions: Plot.Dimensions,
    _context: Plot.Context,
    _next?: Plot.RenderFunction,
  ): SVGElement | null {
    if (index.length) {
      this.callbackFunction(index[0])
    }
    return null
  }
}

const getTicks = (timestamps: Date[], maxTicks: number = 10): Date[] => {
  const step = Math.ceil(timestamps.length / maxTicks)
  return timestamps.filter((_, index) => index % step === 0)
}

const getTickFormat = (
  interval: Interval,
  ticks: Date[],
): ((t: Date, i: number) => any) | string => {
  switch (interval) {
    case Interval.HOUR:
      return (t: Date, i: number) => {
        const previousDate = ticks[i - 1]
        if (!previousDate || previousDate.getDate() < t.getDate()) {
          return d3.timeFormat('%a %H:%M')(t)
        }
        return d3.timeFormat('%H:%M')(t)
      }
    case Interval.DAY:
      return '%b %d'
    case Interval.WEEK:
      return '%b %d'
    case Interval.MONTH:
      return '%b %y'
    case Interval.YEAR:
      return '%Y'
  }
}

interface MeterChartProps {
  data: {
    timestamp: Date
    usage: number
  }[]
  interval: Interval
  metric: Metric
  height?: number
  maxTicks?: number
  onDataIndexHover?: (index: number | undefined) => void
}

const MeterChart: React.FC<MeterChartProps> = ({
  data,
  interval,
  metric,
  height: _height,
  maxTicks: _maxTicks,
  onDataIndexHover,
}) => {
  const [width, setWidth] = useState(0)
  const height = useMemo(() => _height || 400, [_height])
  const maxTicks = useMemo(() => _maxTicks || 10, [_maxTicks])

  const timestamps = useMemo(
    () => data.map(({ timestamp }) => timestamp),
    [data],
  )
  const ticks = useMemo(
    () => getTicks(timestamps, maxTicks),
    [timestamps, maxTicks],
  )
  const valueFormatter = useMemo(() => getValueFormatter(metric), [metric])

  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const resizeObserver = new ResizeObserver((_entries) => {
      if (containerRef) {
        setWidth(containerRef.clientWidth ?? 0)
      }
    })

    if (containerRef) {
      resizeObserver.observe(containerRef)
    }

    return () => {
      if (containerRef) {
        resizeObserver.unobserve(containerRef)
      }
    }
  }, [containerRef])

  const onMouseLeave = useCallback(() => {
    if (onDataIndexHover) {
      onDataIndexHover(undefined)
    }
  }, [onDataIndexHover])

  useEffect(() => {
    if (!containerRef) {
      return
    }

    const plot = Plot.plot({
      style: {
        background: 'none',
      },
      width,
      height,
      marks: [
        () => createAreaGradient(gradientId),
        Plot.axisX({
          tickFormat: getTickFormat(interval, ticks),
          ticks,
          label: null,
          stroke: 'none',
          fontFamily: GeistMono.style.fontFamily,
        }),
        Plot.axisY({
          tickFormat: valueFormatter,
          label: null,
          stroke: 'none',
          fontFamily: GeistMono.style.fontFamily,
        }),
        Plot.areaY(data, {
          x: 'timestamp',
          y: metric.slug,
          fill: `url(#${gradientId})`,
        }),
        Plot.lineY(data, {
          x: 'timestamp',
          y: metric.slug,
          stroke: primaryColor,
          strokeWidth: 2,
        }),
        Plot.ruleX(data, {
          x: 'timestamp',
          stroke: 'currentColor',
          strokeWidth: 1,
          strokeOpacity: 0.2,
        }),
        Plot.ruleX(
          data,
          Plot.pointerX({
            x: 'timestamp',
            stroke: 'currentColor',
            strokeOpacity: 0.5,
            strokeWidth: 2,
          }),
        ),
        Plot.dot(
          data,
          Plot.pointerX({
            x: 'timestamp',
            y: metric.slug,
            fill: primaryColor,
            r: 5,
          }),
        ),
        ...(onDataIndexHover
          ? [
              new Callback(
                data,
                Plot.pointerX({
                  x: 'timestamp',
                  y: metric.slug,
                  fill: primaryColor,
                  fillOpacity: 0.5,
                  r: 5,
                }),
                onDataIndexHover,
              ),
            ]
          : []),
      ],
    })
    containerRef.append(plot)

    return () => plot.remove()
  }, [
    data,
    metric,
    containerRef,
    interval,
    ticks,
    valueFormatter,
    width,
    height,
    onDataIndexHover,
  ])

  return (
    <div
      className="dark:text-polar-500 w-full text-gray-500"
      ref={setContainerRef}
      onMouseLeave={onMouseLeave}
    />
  )
}
