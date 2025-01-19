'use client'

import { MeterEvent } from '@/app/api/meters/data'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MeterChart } from '@/components/Meter/MeterChart'
import { MeterContextView } from '@/components/Meter/MeterContextView'
import { MeterEvents } from '@/components/Meter/MeterEvents'
import { MeterGetStarted } from '@/components/Meter/MeterGetStarted'
import { useMeter, useMeterEvents } from '@/hooks/queries/meters'
import { MoreVert } from '@mui/icons-material'
import { Interval, MetricType } from '@polar-sh/api'
import { useParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { Status } from 'polarkit/components/ui/atoms/Status'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { twMerge } from 'tailwind-merge'

export default function ClientPage() {
  const { slug } = useParams()
  const { data: meter } = useMeter(slug as string)
  const { data: meterEvents } = useMeterEvents(meter?.slug)

  const mockedMeterData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return {
      timestamp: date,
      usage:
        meterEvents?.items
          .filter((event: MeterEvent) => {
            const eventDate = new Date(event.created_at)
            return eventDate.toDateString() === date.toDateString()
          })
          .reduce(
            (total: number, event: MeterEvent) => total + event.value,
            0,
          ) ?? 0,
    }
  }).reverse()

  if (!meter) return null

  return (
    <DashboardBody
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
      contextView={<MeterContextView meter={meter} />}
      contextViewClassName="xl:max-w-[400px]"
    >
      <Tabs defaultValue="overview" className="flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="products">Customers</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-y-12">
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
              <Card className="flex-1">
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
                    {new Date(new Date().setDate(0)).toLocaleDateString(
                      'en-US',
                      {
                        month: 'long',
                        day: 'numeric',
                      },
                    )}
                  </span>
                </CardFooter>
              </Card>
              <Card className="flex-1">
                <CardHeader>
                  <span className="dark:text-polar-500 text-gray-500">
                    Current Period
                  </span>
                </CardHeader>
                <CardContent>
                  <span className="text-4xl">
                    {Intl.NumberFormat('en-US', {
                      notation: 'standard',
                    }).format(meter.value)}
                  </span>
                </CardContent>
                <CardFooter>
                  <span className="dark:text-polar-500 text-gray-500">
                    {new Date(new Date().setDate(1)).toLocaleDateString(
                      'en-US',
                      {
                        month: 'long',
                        day: 'numeric',
                      },
                    )}{' '}
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
          <MeterGetStarted meter={meter} />
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <h3 className="text-xl">Latest meter events</h3>
              <p className="dark:text-polar-500 text-gray-500">
                Recently received meter events
              </p>
            </div>
            <MeterEvents events={meterEvents?.items ?? []} />
          </div>
        </TabsContent>
        <TabsContent value="events">
          <MeterEvents events={meterEvents?.items ?? []} />
        </TabsContent>
      </Tabs>
    </DashboardBody>
  )
}
