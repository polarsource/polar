'use client'

import { Events } from '@/components/Events/Events'
import { MeterChart } from '@/components/Meter/MeterChart'
import MeterEventsTab from '@/components/Meter/MeterEventsTab'
import Spinner from '@/components/Shared/Spinner'
import { useEvents } from '@/hooks/queries/events'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { UTCDate } from '@date-fns/utc'
import { schemas } from '@polar-sh/client'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns'
import { useContext, useMemo } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import FormattedUnits from './FormattedUnits'
import MeterCustomersTab from './MeterCustomersTab'
import { MeterGetStarted } from './MeterGetStarted'
import { MeterUpdateModal } from './MeterUpdateModal'

export const MeterPage = ({
  meter,
  organization,
  isEditMeterModalShown,
  hideEditMeterModal,
}: {
  meter: schemas['Meter']
  organization: schemas['Organization']
  isEditMeterModalShown: boolean
  hideEditMeterModal: () => void
}) => {
  const startChart = useMemo(() => subDays(new UTCDate(), 7), [])
  const endChart = useMemo(() => new UTCDate(), [])
  const { data: chartQuantities, isLoading: chartLoading } = useMeterQuantities(
    meter.id,
    startChart,
    endChart,
    'day',
  )

  const { data } = useEvents(meter.organization_id, { meter_id: meter.id })

  const meterEvents = useMemo(() => {
    if (!data) return []
    return data.items
  }, [data])

  return (
    <>
      <Tabs defaultValue="overview" className="flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-y-12 pb-12">
          {chartLoading ? (
            <div className="flex h-[300px] flex-col items-center justify-center">
              <Spinner />
            </div>
          ) : chartQuantities ? (
            <MeterChart data={chartQuantities.quantities} interval="day" />
          ) : (
            <div className="flex h-[300px] flex-col items-center justify-center">
              <span className="text-lg">No data available</span>
            </div>
          )}
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-row items-center justify-between">
              <h2 className="text-xl">Activity</h2>
            </div>
            <MeterActivityCards meter={meter} />
          </div>
          {meterEvents.length > 0 ? (
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-xl">Latest meter events</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  Recently received meter events
                </p>
              </div>
              <Events events={meterEvents} organization={organization} />
            </div>
          ) : (
            <MeterGetStarted meter={meter} />
          )}
        </TabsContent>
        <TabsContent value="events">
          <MeterEventsTab meter={meter} organization={organization} />
        </TabsContent>
        <TabsContent value="customers">
          <MeterCustomersTab meter={meter} organization={organization} />
        </TabsContent>
      </Tabs>

      <InlineModal
        isShown={isEditMeterModalShown}
        hide={hideEditMeterModal}
        modalContent={
          <MeterUpdateModal
            meter={meter}
            hide={hideEditMeterModal}
            hasProcessedEvents={meterEvents.length > 0}
          />
        }
      />
    </>
  )
}

const MeterActivityCards = ({ meter }: { meter: schemas['Meter'] }) => {
  const { organization } = useContext(OrganizationContext)

  const dates = useMemo(
    () => ({
      currentMonthStart: startOfMonth(new UTCDate()),
      currentMonthEnd: endOfMonth(new UTCDate()),
      lastMonthStart: startOfMonth(subMonths(new UTCDate(), 1)),
      lastMonthEnd: endOfMonth(subMonths(new UTCDate(), 1)),
      allTimeStart: new UTCDate(organization?.created_at),
      allTimeEnd: new UTCDate(),
    }),
    [organization?.created_at],
  )

  const { data: figuresQuantities } = useMeterQuantities(
    meter.id,
    dates.lastMonthStart,
    dates.currentMonthEnd,
    'month',
  )

  const { data: allTimeQuantities } = useMeterQuantities(
    meter.id,
    dates.allTimeStart,
    dates.allTimeEnd,
    'month',
  )

  return (
    <div className="flex flex-row gap-x-8">
      {[
        {
          title: 'Current Month',
          value: figuresQuantities?.quantities[1]?.quantity,
          startDate: dates.currentMonthStart,
          endDate: dates.currentMonthEnd,
        },
        {
          title: 'Previous Month',
          value: figuresQuantities?.quantities[0]?.quantity,
          startDate: dates.lastMonthStart,
          endDate: dates.lastMonthEnd,
        },
        {
          title: 'All Time',
          value: allTimeQuantities?.quantities.reduce(
            (acc, curr) => acc + curr.quantity,
            0,
          ),
          startDate: dates.allTimeStart,
          endDate: dates.allTimeEnd,
        },
      ].map((card, i) => (
        <Card key={i} className="flex-1 rounded-3xl">
          <CardHeader className="flex flex-col gap-y-0">
            <h3 className="text-lg">{card.title}</h3>
            <span className="dark:text-polar-500 text-gray-500">
              {card.startDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                ...(card.startDate.getFullYear() !==
                  new Date().getFullYear() && {
                  year: 'numeric',
                }),
              })}{' '}
              -{' '}
              {card.endDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                ...(card.endDate.getFullYear() !== new Date().getFullYear() && {
                  year: 'numeric',
                }),
              })}
            </span>
          </CardHeader>
          <CardContent>
            <span className="text-4xl">
              {card.value ? <FormattedUnits value={card.value} /> : '—'}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
