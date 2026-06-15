'use client'

import { useOrganization } from '@/hooks/queries'
import { usePayoutAccountSetup } from '@/hooks/usePayoutAccountSetup'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { ArrowRight, BanknoteIcon, CheckIcon } from 'lucide-react'
import { PathCardBanner } from './PathCardBanner'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  reasonItems: string[]
}

export const PayoutAccountSection = ({
  organization: initialOrg,
  step,
  reasonItems,
}: Props) => {
  const tone = step.status === 'failed' ? 'danger' : 'warning'
  const banners = reasonItems.length > 0 && (
    <Box flexDirection="column" rowGap="m">
      {reasonItems.map((reason) => (
        <PathCardBanner key={reason} tone={tone} title={reason} />
      ))}
    </Box>
  )
  const { data: organization = initialOrg } = useOrganization(
    initialOrg.id,
    true,
    initialOrg,
  )
  const { payoutAccount, openManage, openPrimary, modals } =
    usePayoutAccountSetup(
      organization,
      `/dashboard/${organization.slug}/finance/account`,
    )

  const isStripeAccount = payoutAccount?.type === 'stripe'
  const isManualAccount = payoutAccount && !isStripeAccount

  if (isManualAccount) {
    return (
      <>
        <StatusBlock
          tone="neutral"
          icon={BanknoteIcon}
          title="Manual payouts"
          description={
            <>
              You are receiving manual payouts.{' '}
              <a
                href="mailto:support@polar.sh"
                className="underline hover:no-underline"
              >
                Reach out to support
              </a>{' '}
              to request a payout or change this.
            </>
          }
        />
        {modals}
        {banners}
      </>
    )
  }

  if (isStripeAccount) {
    const ready = payoutAccount.is_payout_ready
    return (
      <>
        <StatusBlock
          tone={ready ? 'success' : 'pending'}
          icon={ready ? CheckIcon : BanknoteIcon}
          title={
            ready ? 'Payout account connected' : 'Payout account needs setup'
          }
          description={
            ready
              ? 'Your Stripe payout account is configured and ready to receive payouts.'
              : 'Your Stripe payout account is connected but onboarding isn’t complete yet.'
          }
          action={
            <Button onClick={openManage}>
              Manage payout accounts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
        {modals}
        {banners}
      </>
    )
  }

  return (
    <>
      <StatusBlock
        tone="neutral"
        icon={BanknoteIcon}
        title="Connect payout account"
        description="Connect or create a Stripe account to receive payments from your customers."
        action={
          <Button onClick={openPrimary}>
            Connect payout account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />
      {modals}
      {banners}
    </>
  )
}
