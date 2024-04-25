'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useSubscriptionTiers } from '@/hooks/queries'
import { useRecurringInterval } from '@/hooks/subscriptions'
import { Add, Bolt } from '@mui/icons-material'
import { Organization, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import React, { useEffect, useMemo } from 'react'
import EmptyLayout from '../Layout/EmptyLayout'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CreateSubscriptionTierModal from './CreateSubscriptionTierModal'
import EditSubscriptionTierModal from './EditSubscriptionTierModal'
import SubscriptionTierCard from './SubscriptionTierCard'
import SubscriptionTierRecurringIntervalSwitch from './SubscriptionTierRecurringIntervalSwitch'

interface TiersPageProps {
  organization: Organization
}

const TiersPage: React.FC<TiersPageProps> = ({ organization }) => {
  const { data: subscriptionTiers } = useSubscriptionTiers(organization.name)
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(subscriptionTiers?.items || [])

  const searchParams = useSearchParams()
  const router = useRouter()

  const {
    isShown: isCreateSubscriptionTierModalShown,
    show: showCreateSubscriptionTierModal,
    hide: hideCreateSubscriptionTierModal,
  } = useModal()

  const {
    isShown: isEditSubscriptionTierModalShown,
    show: showEditSubscriptionTierModal,
    hide: hideEditSubscriptionTierModal,
  } = useModal()

  useEffect(() => {
    if (searchParams.has('new')) {
      showCreateSubscriptionTierModal()
    } else {
      hideCreateSubscriptionTierModal()
    }

    if (searchParams.has('tierId')) {
      showEditSubscriptionTierModal()
    } else {
      hideEditSubscriptionTierModal()
    }
  }, [searchParams])

  const defaultSubscriptionType = useMemo(() => {
    switch (searchParams.get('type')) {
      case 'individual':
        return SubscriptionTierType.INDIVIDUAL
      case 'business':
        return SubscriptionTierType.BUSINESS
      default:
        return undefined
    }
  }, [searchParams])

  const subscriptionTierId = searchParams.get('tierId')

  if (!subscriptionTiers?.items?.length) {
    return (
      <EmptyLayout>
        <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-10 py-96 text-gray-400">
          <span className="text-6xl text-blue-400">
            <Bolt fontSize="inherit" />
          </span>
          <h2 className="text-lg">
            You haven&apos;t configured any subscription tiers
          </h2>
          <Link
            href={`/maintainer/${organization.name}/subscriptions/tiers?new`}
          >
            <Button variant="secondary">Create Subscription Tier</Button>
          </Link>
        </div>
      </EmptyLayout>
    )
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-12 py-2">
        <div className="flex flex-col justify-between gap-y-8 md:flex-row md:gap-y-0">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-lg font-medium">Subscription Tiers</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Manage your subscription tiers & benefits
            </p>
          </div>

          <Button onClick={showCreateSubscriptionTierModal}>
            <Add className="mr-2" fontSize="small" />
            New Tier
          </Button>
        </div>
        {hasBothIntervals && (
          <div className="flex justify-center">
            <SubscriptionTierRecurringIntervalSwitch
              recurringInterval={recurringInterval}
              onChange={setRecurringInterval}
            />
          </div>
        )}
        <div className="flex flex-row flex-wrap gap-6">
          {subscriptionTiers.items.map((tier) => (
            <SubscriptionTierCard
              className="w-full self-stretch md:max-w-[286px]"
              key={tier.id}
              subscriptionTier={tier}
              recurringInterval={recurringInterval}
            >
              <Link
                key={tier.id}
                href={`/maintainer/${organization.name}/subscriptions/tiers?tierId=${tier.id}`}
                className="w-full"
              >
                <Button variant="outline" fullWidth>
                  Edit Tier
                </Button>
              </Link>
            </SubscriptionTierCard>
          ))}
        </div>
      </div>
      <InlineModal
        modalContent={
          <CreateSubscriptionTierModal
            type={defaultSubscriptionType}
            organization={organization}
            hide={() => {
              router.replace(
                `/maintainer/${organization?.name}/subscriptions/tiers`,
              )
              hideCreateSubscriptionTierModal()
            }}
          />
        }
        isShown={isCreateSubscriptionTierModalShown}
        hide={() => {
          router.replace(
            `/maintainer/${organization?.name}/subscriptions/tiers`,
          )
          hideCreateSubscriptionTierModal()
        }}
      />
      <InlineModal
        modalContent={
          subscriptionTierId ? (
            <EditSubscriptionTierModal
              tier={subscriptionTierId}
              organization={organization}
              hide={() => {
                router.replace(
                  `/maintainer/${organization?.name}/subscriptions/tiers`,
                )
                hideEditSubscriptionTierModal()
              }}
            />
          ) : (
            <></>
          )
        }
        isShown={isEditSubscriptionTierModalShown}
        hide={() => {
          router.replace(
            `/maintainer/${organization?.name}/subscriptions/tiers`,
          )
          hideEditSubscriptionTierModal()
        }}
      />
    </DashboardBody>
  )
}

export default TiersPage
