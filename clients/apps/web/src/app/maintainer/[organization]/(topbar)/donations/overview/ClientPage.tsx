'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Chart } from '@/components/Subscriptions/SubscriptionsChart'
import { Donation, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { Banner } from 'polarkit/components/ui/molecules'
import { useDonationStatistics, useUpdateOrganization } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
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

export default function ClientPage({
  organization,
  donations,
}: {
  organization: Organization
  donations: Donation[]
}) {
  const updateOrganization = useUpdateOrganization()

  const router = useRouter()

  const [enablingDonations, setEnablingDonations] = useState(false)

  const enableDonations = async () => {
    setEnablingDonations(true)

    await updateOrganization
      .mutateAsync({
        id: organization.id,
        settings: {
          donations_enabled: true,
        },
      })
      .then(() => {
        router.refresh()
      })
      .catch(() => {
        setEnablingDonations(false)
      })
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Overview</h2>
        </div>

        {!organization.donations_enabled ? (
          <Banner color={'blue'}>
            <div className="flex w-full items-center justify-between">
              {"You're currently not accepting donations on Polar."}
              <Button
                size={'sm'}
                loading={enablingDonations}
                onClick={enableDonations}
              >
                Enable donations
              </Button>
            </div>
          </Banner>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DonationActivity organization={organization} donations={donations} />
          <DonationsEarnings organization={organization} />
        </div>
      </div>
    </DashboardBody>
  )
}

const DonationsEarnings = ({
  organization,
}: {
  organization: Organization
}) => {
  const statistics = useDonationStatistics({
    toOrganizationId: organization.id,
    startDate: startOfMonthThreeMonthsAgo,
    endDate: today,
    interval: 'month',
  })

  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<
    number | undefined
  >()

  const current =
    idxOrLast(statistics.data?.periods || [], hoveredPeriodIndex)?.sum ?? 0

  const currentDate =
    idxOrLast(statistics.data?.periods || [], hoveredPeriodIndex)?.start_date ??
    ''

  return (
    <>
      {statistics.data && (
        <Card className="flex w-full flex-col gap-y-4 rounded-3xl p-4">
          <div className="flex w-full flex-grow flex-row items-center justify-between p-2">
            <h3 className="text-sm font-medium">Earnings</h3>
            <div className="flex flex-col">
              <span className="text-right text-sm">
                ${getCentsInDollarString(current)}
              </span>
              <span className="text-xs text-gray-500">
                <FormattedDateTime datetime={currentDate} resolution="month" />
              </span>
            </div>
          </div>
          <Chart
            maxHeight={300}
            y="sum"
            axisYOptions={{
              ticks: 'month',
              label: null,
            }}
            data={statistics.data.periods.map((d) => ({
              ...d,
              parsedStartDate: new Date(d.start_date),
            }))}
            onDataIndexHover={setHoveredPeriodIndex}
            hoveredIndex={hoveredPeriodIndex}
          />
        </Card>
      )}
    </>
  )
}

const DonationActivity = ({
  organization,
  donations,
}: {
  organization: Organization
  donations: Donation[]
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-medium">Donation Activity</div>
        <div className="dark:text-polar-500 text-gray-400">
          The last 5 donations
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {donations.map((donation) => (
          <div key={donation.id} className="flex flex-row items-center">
            <div className="flex flex-1 flex-row items-center gap-2">
              {donation.donor ? (
                <>
                  {'is_personal' in donation.donor ? (
                    <>
                      <Avatar
                        avatar_url={donation.donor.avatar_url}
                        name={donation.donor.name}
                        className="h-8 w-8"
                      />
                    </>
                  ) : (
                    <>
                      <Avatar
                        avatar_url={donation.donor.avatar_url}
                        name={donation.donor.public_name}
                        className="h-8 w-8"
                      />
                    </>
                  )}
                </>
              ) : null}

              <div className="flex flex-col text-sm">
                {donation.donor ? (
                  <>
                    {'is_personal' in donation.donor ? (
                      <>
                        <div className="font-medium">{donation.donor.name}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">
                          {donation.donor.public_name}
                        </div>
                      </>
                    )}{' '}
                  </>
                ) : (
                  <div className="fw-medium">{donation.email}</div>
                )}

                <div className="dark:text-polar-500 text-xs text-gray-400">
                  <FormattedDateTime datetime={donation.created_at} />
                </div>
              </div>
            </div>

            {donation.message ? (
              <div className="text-sm text-gray-600">
                &quot;{donation.message}&quot;
              </div>
            ) : null}

            <div className="ml-4 flex  flex-shrink-0  items-center justify-between gap-3">
              <div className="dark:text-polar-950 inline-flex gap-1 whitespace-nowrap rounded-xl bg-green-500 px-3 py-1 text-xs text-white">
                <div>${getCentsInDollarString(donation.amount.amount)}</div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
