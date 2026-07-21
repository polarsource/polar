'use client'

import { usePayoutAccountSetup } from '@/hooks/usePayoutAccountSetup'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight, BanknoteIcon, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'
import { StatusBlock } from '../Account/sections/StatusBlock'
import { CheckPayoutStatusButton } from '../CheckPayoutStatusButton'
import { getPayoutAccountPresentation } from '../payoutAccountPresentation'
import { payoutOnboardingReturnPath } from '../payoutOnboardingReturn'

interface PayoutAccountStepProps {
  organization: schemas['Organization']
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <Box
    flexDirection="column"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    backgroundColor="background-card"
  >
    {children}
  </Box>
)

export default function PayoutAccountStep({
  organization,
}: PayoutAccountStepProps) {
  const returnPath = payoutOnboardingReturnPath(organization.slug)
  const { payoutAccount, openPrimary, modals } = usePayoutAccountSetup(
    organization,
    returnPath,
  )

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

  const handleStartAccountSetup = useCallback(async () => {
    if (!payoutAccount) {
      openPrimary()
      return
    }
    const link = await unwrap(
      api.POST('/v1/payout-accounts/{id}/onboarding-link', {
        params: {
          path: { id: payoutAccount.id },
          query: {
            return_path: payoutOnboardingReturnPath(
              organization.slug,
              payoutAccount.id,
            ),
          },
        },
      }),
    )
    window.location.href = link.url
  }, [payoutAccount, organization.slug, openPrimary])

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!payoutAccount) return
    setIsLoadingDashboard(true)
    try {
      const link = await unwrap(
        api.POST('/v1/payout-accounts/{id}/dashboard-link', {
          params: { path: { id: payoutAccount.id } },
        }),
      )
      window.open(link.url, '_blank')
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [payoutAccount])

  if (payoutAccount && payoutAccount.type !== 'stripe') {
    return (
      <Card>
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
      </Card>
    )
  }

  const { state, tone, icon, title, description } =
    getPayoutAccountPresentation(payoutAccount)

  const startSetupAction = (
    <Button onClick={handleStartAccountSetup}>
      Continue with Account Setup
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  )

  const action = () => {
    if (!payoutAccount) {
      return startSetupAction
    }
    switch (state) {
      case 'ready':
        return (
          <Button
            onClick={handleOpenStripeDashboard}
            loading={isLoadingDashboard}
          >
            Open in Stripe
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        )
      case 'paused':
        return (
          <Box flexDirection="column" alignItems="center" rowGap="s">
            <Button onClick={() => window.open('mailto:support@polar.sh')}>
              Contact support
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <CheckPayoutStatusButton payoutAccount={payoutAccount} />
          </Box>
        )
      case 'under_review':
        return (
          <CheckPayoutStatusButton
            payoutAccount={payoutAccount}
            variant="default"
          />
        )
      default:
        return startSetupAction
    }
  }

  return (
    <>
      <Card>
        <StatusBlock
          tone={tone}
          icon={icon}
          title={title}
          description={description}
          action={action()}
        />
      </Card>
      {modals}
    </>
  )
}
