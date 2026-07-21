'use client'

import { toast } from '@/components/Toast/use-toast'
import { useOrganization } from '@/hooks/queries'
import { usePayoutAccountSetup } from '@/hooks/usePayoutAccountSetup'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { ArrowRight, BanknoteIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { CheckPayoutStatusButton } from '../../CheckPayoutStatusButton'
import { getPayoutAccountPresentation } from '../../payoutAccountPresentation'
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
  const requirementsDue = (step.reasons ?? []).includes(
    'payout_account.requirements_due',
  )
  const tone =
    step.status === 'failed' && !requirementsDue ? 'danger' : 'warning'
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
  const returnPath = `/dashboard/${organization.slug}/finance/account`
  const { payoutAccount, openManage, openPrimary, modals } =
    usePayoutAccountSetup(organization, returnPath)

  const [resumeLoading, setResumeLoading] = useState(false)
  const resumeOnboarding = useCallback(async () => {
    if (!payoutAccount) return
    setResumeLoading(true)
    const { data, error } = await api.POST(
      '/v1/payout-accounts/{id}/onboarding-link',
      {
        params: {
          path: { id: payoutAccount.id },
          query: { return_path: returnPath },
        },
      },
    )
    if (error || !data) {
      setResumeLoading(false)
      toast({
        title: 'Could not resume payout setup',
        description: 'Please try again from Manage payout accounts.',
      })
      openManage()
      return
    }
    window.location.href = data.url
  }, [payoutAccount, returnPath, openManage])

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
    const presentation = getPayoutAccountPresentation(payoutAccount)
    const { state } = presentation

    const primaryAction =
      state === 'incomplete' ? (
        <Button onClick={resumeOnboarding} loading={resumeLoading}>
          Finish payout setup
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      ) : state === 'paused' ? (
        <Button onClick={() => window.open('mailto:support@polar.sh')}>
          Contact support
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      ) : null

    const canCheckStatus = state === 'under_review' || state === 'paused'

    return (
      <>
        <StatusBlock
          tone={presentation.tone}
          icon={presentation.icon}
          title={presentation.title}
          description={presentation.description}
          action={
            <Box flexDirection="column" alignItems="center" rowGap="s">
              {primaryAction}
              {canCheckStatus && (
                <CheckPayoutStatusButton
                  payoutAccount={payoutAccount}
                  variant={primaryAction ? 'ghost' : 'default'}
                />
              )}
              {primaryAction ? (
                <Button variant="ghost" size="sm" onClick={openManage}>
                  Manage payout accounts
                </Button>
              ) : (
                <Button onClick={openManage}>
                  Manage payout accounts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </Box>
          }
        />
        {modals}
        {banners}
      </>
    )
  }

  const presentation = getPayoutAccountPresentation(undefined)

  return (
    <>
      <StatusBlock
        tone={presentation.tone}
        icon={presentation.icon}
        title={presentation.title}
        description={presentation.description}
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
