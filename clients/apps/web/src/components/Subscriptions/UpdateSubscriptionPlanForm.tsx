'use client'

import { useDiscount, useProduct } from '@/hooks/queries'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { useTrialChangeOutcome } from '@/utils/trial-change'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm, useWatch } from 'react-hook-form'
import { ProductCombobox } from '../Products/ProductCombobox'
import { ProrationBehavior } from '../Settings/ProrationBehavior'
import AmountLabel from '../Shared/AmountLabel'
import { toast } from '../Toast/use-toast'
import { SubscriptionDiscountField } from './SubscriptionDiscountField'
import { UpdateSubscriptionChangeSummary } from './UpdateSubscriptionChangeSummary'
import { UpdateSubscriptionProductWarning } from './UpdateSubscriptionProductWarning'
import { UpdateSubscriptionSection } from './UpdateSubscriptionSection'
import {
  isDiscountApplicableToProduct,
  subscriptionUpdateValidationDiscriminators,
} from './utils'

export const UpdateSubscriptionPlanForm = ({
  subscription,
  onUpdate,
  organization,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
  organization: schemas['Organization']
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)

  const defaultProrationBehavior =
    organization.subscription_settings.proration_behavior
  const currentDiscountId = subscription.discount_id ?? null

  const form = useForm<schemas['SubscriptionUpdateBase']>({
    defaultValues: {
      discount_id: currentDiscountId,
      proration_behavior: defaultProrationBehavior,
    },
  })
  const { control, handleSubmit, setError, setValue } = form

  const selectedProductId = useWatch({ control, name: 'product_id' })
  const selectedDiscountId = useWatch({ control, name: 'discount_id' })
  const selectedProrationBehavior = useWatch({
    control,
    name: 'proration_behavior',
  })
  const { data: selectedProduct } = useProduct(selectedProductId)
  const { data: selectedDiscount } = useDiscount(
    subscription.product.organization_id,
    selectedDiscountId,
  )
  const trialOutcome = useTrialChangeOutcome(
    subscription,
    selectedProduct,
    selectedProrationBehavior,
  )

  const isChangingProduct = !!selectedProductId
  const isChangingDiscount = (selectedDiscountId ?? null) !== currentDiscountId

  const previewChange: schemas['SubscriptionChangeProduct'] | null =
    selectedProductId
      ? {
          product_id: selectedProductId,
          proration_behavior: selectedProrationBehavior,
          ...(isChangingDiscount
            ? { discount_id: selectedDiscountId ?? null }
            : {}),
        }
      : null

  const onSubmit = async ({
    product_id,
    proration_behavior,
    discount_id,
  }: schemas['SubscriptionUpdateBase']) => {
    const discountChanged = (discount_id ?? null) !== currentDiscountId
    const { error } = await updateSubscription.mutateAsync({
      ...(product_id ? { product_id, proration_behavior } : {}),
      ...(discountChanged ? { discount_id: discount_id ?? null } : {}),
    })

    if (error) {
      if (error.detail)
        if (isValidationError(error.detail)) {
          setValidationErrors(
            error.detail,
            setError,
            undefined,
            subscriptionUpdateValidationDiscriminators,
          )
        } else {
          toast({
            title: 'Subscription update failed',
            description: `Error while updating subscription ${subscription.product.name}: ${extractApiErrorMessage(error)}`,
          })
        }
      return
    }

    toast({
      title: 'Subscription updated',
      description: `Subscription ${subscription.product.name} successfully updated`,
    })
    onUpdate?.()
  }

  return (
    <Form {...form}>
      <Box
        as="form"
        flexDirection="column"
        rowGap="2xl"
        onSubmit={handleSubmit(onSubmit)}
      >
        <UpdateSubscriptionSection>
          <FormField
            control={control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New product</FormLabel>
                <FormControl>
                  <ProductCombobox
                    organizationId={subscription.product.organization_id}
                    value={field.value ?? undefined}
                    onChange={(productId) => {
                      field.onChange(productId)
                      if (
                        selectedDiscount &&
                        !isDiscountApplicableToProduct(
                          selectedDiscount,
                          productId ?? subscription.product_id,
                        )
                      ) {
                        setValue('discount_id', null)
                      }
                    }}
                    currency={subscription.currency}
                    currentProductId={subscription.product_id}
                    currentPriceIds={subscription.prices.map(({ id }) => id)}
                    currentPlan={{
                      name: subscription.product.name,
                      price: (
                        <AmountLabel
                          amount={subscription.amount}
                          currency={subscription.currency}
                          interval={subscription.recurring_interval}
                          intervalCount={subscription.recurring_interval_count}
                        />
                      ),
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isChangingProduct && subscription.status !== 'trialing' && (
            <FormField
              control={control}
              name="proration_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proration behavior</FormLabel>
                  <FormControl>
                    <div>
                      <ProrationBehavior
                        organization={organization}
                        value={field.value || defaultProrationBehavior}
                        onValueChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <SubscriptionDiscountField
            control={control}
            subscription={subscription}
            targetProductId={selectedProductId || subscription.product_id}
          />
        </UpdateSubscriptionSection>

        {(isChangingProduct || isChangingDiscount) && (
          <UpdateSubscriptionSection title="Summary" divider>
            <UpdateSubscriptionChangeSummary
              subscription={subscription}
              selectedProduct={selectedProduct}
              change={previewChange}
              isChangingDiscount={isChangingDiscount}
              newDiscountId={selectedDiscountId ?? null}
              trialOutcome={trialOutcome}
            />
            {selectedProduct && (
              <UpdateSubscriptionProductWarning
                subscription={subscription}
                selectedProduct={selectedProduct}
                trialOutcome={trialOutcome}
              />
            )}
          </UpdateSubscriptionSection>
        )}

        <Button
          type="submit"
          size="lg"
          loading={updateSubscription.isPending}
          disabled={
            !(isChangingProduct || isChangingDiscount) ||
            updateSubscription.isPending
          }
        >
          {trialOutcome?.kind === 'ends'
            ? 'Update Subscription & End Trial'
            : 'Update Subscription'}
        </Button>
      </Box>
    </Form>
  )
}
