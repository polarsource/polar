'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
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
import { useUpdateOrganization } from 'polarkit/hooks'
import { useState } from 'react'

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
          <Card>
            <CardHeader>
              <div className="text-lg font-medium">Donation Activity</div>
              <div className="dark:text-polar-500 text-gray-400">
                The last 5 donations
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex flex-row items-center justify-between"
                >
                  <div className="flex flex-row items-center justify-center gap-2">
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
                              <div className="font-medium">
                                {donation.donor.name}
                              </div>
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
                        <div className="font-medium">Anonymous</div>
                      )}

                      <div className="dark:text-polar-500 text-xs text-gray-400">
                        <FormattedDateTime datetime={donation.created_at} />
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    &quot;{donation.message}&quot;
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardBody>
  )
}
