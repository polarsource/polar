'use client'

import { schemas } from '@polar-sh/client'
import { InlineModalHeader } from '@polar-sh/orbit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@polar-sh/orbit'
import { UpdateSubscriptionBillingPeriodForm } from './UpdateSubscriptionBillingPeriodForm'
import { UpdateSubscriptionPlanForm } from './UpdateSubscriptionPlanForm'
import { UpdateSubscriptionSeatsForm } from './UpdateSubscriptionSeatsForm'
import { UpdateSubscriptionTrialForm } from './UpdateSubscriptionTrialForm'

const UpdateSubscriptionModal = ({
  subscription,
  onUpdate,
  organization,
  hide,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
  organization: schemas['Organization']
  hide: () => void
}) => {
  const isActive = subscription.status === 'active'
  const isTrialing = subscription.status === 'trialing'
  const isSeatBased = !!subscription.seats && subscription.seats > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h2 className="text-xl">Update Subscription</h2>
      </InlineModalHeader>
      <div className="flex grow flex-col gap-8 px-8 pb-12">
        <Tabs defaultValue="plan">
          <TabsList className="mb-8">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            {isTrialing && <TabsTrigger value="trial">Trial</TabsTrigger>}
            {isActive && (
              <TabsTrigger value="billing-period">Billing Period</TabsTrigger>
            )}
            {(isActive || isTrialing) && isSeatBased && (
              <TabsTrigger value="seats">Seats</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="plan">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionPlanForm
                subscription={subscription}
                onUpdate={onUpdate}
                organization={organization}
              />
            </div>
          </TabsContent>

          <TabsContent value="trial">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionTrialForm
                subscription={subscription}
                onUpdate={onUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="billing-period">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionBillingPeriodForm
                subscription={subscription}
                onUpdate={onUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="seats">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionSeatsForm
                subscription={subscription}
                onUpdate={onUpdate}
                organization={organization}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default UpdateSubscriptionModal
