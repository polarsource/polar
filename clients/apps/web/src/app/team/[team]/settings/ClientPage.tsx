'use client'

import { Section, SectionDescription } from '@/components/Settings/Section'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentTeamFromURL } from '@/hooks/org'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentTeamFromURL()

  const credits = useOrganizationCredits(org?.id)

  if (!isLoaded || !org) {
    return <Spinner />
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-medium">Team settings</h2>
      </div>

      <div className="dark:divide-polar-700 divide-y divide-gray-200">
        <Section>
          <SectionDescription title="Payment methods" />
          <PaymentMethodSettings org={org} credits={credits.data} />
        </Section>
      </div>
    </>
  )
}

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { CreditBalance, Organization } from '@polar-sh/sdk'
import { api } from 'polarkit/api'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import { useOrganizationCredits } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import { useState } from 'react'

const PaymentMethodSettings = ({
  org,
  credits,
}: {
  org: Organization
  credits?: CreditBalance
}) => {
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
      {credits && credits.amount.amount < 0 ? (
        <div className="dark:text-polar:300 space-y-2 p-4 text-sm text-gray-500">
          {org.name} has $
          {getCentsInDollarString(credits.amount.amount * -1, true, true)} in
          prepaid credits that will automatically be applied on future invoices.
        </div>
      ) : null}
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
