'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Chart } from '@/components/Subscriptions/SubscriptionsChart'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Card } from 'polarkit/components/ui/atoms'
import { useTrafficStatistics } from 'polarkit/hooks'
import { useState } from 'react'

const startOfMonth = new Date()
startOfMonth.setUTCHours(0, 0, 0, 0)
startOfMonth.setUTCDate(1)

const startOfMonthThreeMonthsAgo = new Date()
startOfMonthThreeMonthsAgo.setUTCHours(0, 0, 0, 0)
startOfMonthThreeMonthsAgo.setUTCDate(1)
startOfMonthThreeMonthsAgo.setUTCMonth(startOfMonth.getMonth() - 2)

const today = new Date()

function idxOrLast<T>(arr: Array<T>, idx?: number): T | undefined {
  if (idx !== undefined) {
    return arr[idx]
  }
  if (arr.length === 0) {
    return undefined
  }
  return arr[arr.length - 1]
}

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const trafficStatistics = useTrafficStatistics({
    orgName: org?.name ?? '',
    platform: org?.platform,
    startDate: startOfMonthThreeMonthsAgo,
    endDate: today,
    interval: 'day',
  })

  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()

  const currentTraffic =
    idxOrLast(trafficStatistics.data?.periods || [], hoveredPeriodIndex)
      ?.views ?? 0

  const currentTrafficDate =
    idxOrLast(trafficStatistics.data?.periods || [], hoveredPeriodIndex)
      ?.start_date ?? ''

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex w-full flex-col-reverse items-start gap-y-12  xl:flex-row xl:gap-x-12 xl:gap-y-0">
          <div className="flex w-full flex-col gap-y-8 overflow-hidden">
            <div className="flex flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Traffic
              </h3>
            </div>

            <div className="top-8 flex flex-shrink-0 flex-col gap-y-8">
              <div className="flex w-full flex-shrink-0 gap-2">
                {trafficStatistics.data && (
                  <Card className="flex w-full flex-col gap-y-4 rounded-3xl p-4">
                    <div className="flex w-full flex-grow flex-row items-center justify-between p-2">
                      <h3 className="text-sm font-medium">Daily views</h3>
                      <div className="flex flex-col">
                        <span className="text-right text-sm">
                          {currentTraffic.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {currentTrafficDate}
                        </span>
                      </div>
                    </div>
                    <Chart
                      maxHeight={300}
                      y="views"
                      axisYOptions={{
                        ticks: 'day',
                        label: null,
                      }}
                      data={trafficStatistics.data.periods.map((d) => ({
                        ...d,
                        parsedStartDate: new Date(d.start_date),
                      }))}
                      onDataIndexHover={setHoveredPeriodIndex}
                      hoveredIndex={hoveredPeriodIndex}
                    />
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
