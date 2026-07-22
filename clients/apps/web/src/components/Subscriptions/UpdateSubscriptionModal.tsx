'use client'

import { schemas } from '@polar-sh/client'
import { InlineModalHeader } from '@polar-sh/orbit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@polar-sh/orbit'
import { UpdateSubscriptionBillingPeriodForm } from './UpdateSubscriptionBillingPeriodForm'
import { UpdateSubscriptionDiscountForm } from './UpdateSubscriptionDiscountForm'
import { UpdateSubscriptionProductForm } from './UpdateSubscriptionProductForm'
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
  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing'

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h2 className="text-xl">Update Subscription</h2>
      </InlineModalHeader>
      <div className="flex h-full flex-col gap-8 px-8 pb-12">
        <Tabs defaultValue="product">
          <TabsList className="mb-8">
            <TabsTrigger value="product">Product</TabsTrigger>
            <TabsTrigger value="discount">Discount</TabsTrigger>
            {isActive && <TabsTrigger value="trial">Trial</TabsTrigger>}
            {isActive && (
              <TabsTrigger value="billing-period">Billing Period</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="product">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionProductForm
                subscription={subscription}
                onUpdate={onUpdate}
                organization={organization}
              />
            </div>
          </TabsContent>

          <TabsContent value="discount">
            <div className="flex h-full flex-col gap-4">
              <UpdateSubscriptionDiscountForm
                subscription={subscription}
                onUpdate={onUpdate}
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
        </Tabs>
      </div>
    </div>
  )
}

export default UpdateSubscriptionModal
