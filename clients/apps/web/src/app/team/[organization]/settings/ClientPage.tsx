'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section, SectionDescription } from '@/components/Settings/Section'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div>
        <h2 className="text-2xl font-medium">Team settings</h2>
      </div>

      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings org={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Organization } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import { useState } from 'react'

const PaymentMethodSettings = ({ org }: { org: Organization }) => {
  const [stripePortalLoading, setStripePortalLoading] = useState(false)

  const onGotoStripeCustomerPortal = async () => {
    setStripePortalLoading(true)

    const portal = await api.organizations.createStripeCustomerPortal({
      id: org.id,
    })
    if (portal) {
      window.location.href = portal.url
    }

    setStripePortalLoading(false)
  }

  return (
    <div className="dark:text-polar-200 dark:border-polar-700 dark:bg-polar-800 flex w-full flex-col divide-y rounded-xl border text-gray-900">
      <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
        <PrimaryButton
          fullWidth={false}
          classNames=""
          loading={stripePortalLoading}
          onClick={onGotoStripeCustomerPortal}
        >
          <ArrowTopRightOnSquareIcon className="mr-2 h-5 w-5" />
          <span>Invoice settings and receipts</span>
        </PrimaryButton>
      </div>
    </div>
  )
}
