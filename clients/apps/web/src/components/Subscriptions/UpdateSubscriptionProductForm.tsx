'use client'

import { useProducts } from '@/hooks/queries'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { useTrialChangeOutcome } from '@/utils/trial-change'
import { isValidationError, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button, Text } from '@polar-sh/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { ProrationBehavior } from '../Settings/ProrationBehavior'
import AmountLabel from '../Shared/AmountLabel'
import { toast } from '../Toast/use-toast'
import { SubscriptionProductPicker } from './SubscriptionProductPicker'
import { UpdateSubscriptionProductWarning } from './UpdateSubscriptionProductWarning'

const validationDiscriminators = [
  'SubscriptionUpdateBase',
  'SubscriptionUpdateBillingPeriod',
]

export const UpdateSubscriptionProductForm = ({
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

  const form = useForm<schemas['SubscriptionUpdateBase']>({
    defaultValues: {
      proration_behavior: defaultProrationBehavior,
    },
  })
  const { control, handleSubmit, setError, watch } = form
  const { data: allProducts, isLoading: isLoadingProducts } = useProducts(
    subscription.product.organization_id,
    {
      is_recurring: true,
      limit: 100,
      sorting: ['price_amount'],
    },
  )

  const activePriceIds = useMemo(
    () => subscription.prices.map(({ id }) => id),
    [subscription],
  )
  const products = useMemo(() => {
    if (!allProducts) return []

    return allProducts.items
      .filter((product) => !hasLegacyRecurringPrices(product))
      .filter((product) => {
        if (subscription.product_id !== product.id) {
          return true
        }

        const productPriceIds = product.prices.map(({ id }) => id)

        if (productPriceIds.length !== activePriceIds.length) {
          return true
        }
        return !productPriceIds.every((id) => activePriceIds.includes(id))
      })
  }, [allProducts, activePriceIds, subscription])

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedProductId = watch('product_id')
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  )

  const trialOutcome = useTrialChangeOutcome(subscription, selectedProduct)

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateBase']) => {
      await updateSubscription.mutateAsync(body).then(({ error }) => {
        if (error) {
          if (error.detail)
            if (isValidationError(error.detail)) {
              setValidationErrors(
                error.detail,
                setError,
                undefined,
                validationDiscriminators,
              )
            } else {
              toast({
                title: 'Subscription update failed',
                description: `Error while updating subscription ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Subscription updated',
          description: `Subscription ${subscription.product.name} successfully updated`,
        })
        onUpdate?.()
      })
    },
    [updateSubscription, subscription, setError, onUpdate],
  )

  return (
    <Form {...form}>
      <form
        className="flex grow flex-col justify-between gap-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Box flexDirection="column" rowGap="xl">
          <FormField
            control={control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <Box flexDirection="column" rowGap="none">
                  <FormLabel>New product</FormLabel>
                  <Box
                    alignItems="baseline"
                    justifyContent="between"
                    columnGap="s"
                    flexWrap="wrap"
                    color="text-secondary"
                    paddingTop="xs"
                  >
                    <Text variant="caption" color="muted">
                      Current: {subscription.product.name}
                    </Text>
                    <span className="text-xs leading-none [&_*]:!text-inherit">
                      <AmountLabel
                        amount={subscription.amount}
                        currency={subscription.currency}
                        interval={subscription.recurring_interval}
                        intervalCount={subscription.recurring_interval_count}
                      />
                    </span>
                  </Box>
                </Box>
                <FormControl>
                  <SubscriptionProductPicker
                    products={products}
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                    currency={subscription.currency}
                    currentProductId={subscription.product_id}
                    isLoading={isLoadingProducts}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {subscription.status !== 'trialing' && (
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
        </Box>
        <Box flexDirection="column" rowGap="l">
          <Button
            type="submit"
            size="lg"
            loading={updateSubscription.isPending}
            disabled={updateSubscription.isPending}
          >
            {trialOutcome?.kind === 'ends'
              ? 'Update Subscription & End Trial'
              : 'Update Subscription'}
          </Button>
          {selectedProduct ? (
            <UpdateSubscriptionProductWarning
              subscription={subscription}
              selectedProduct={selectedProduct}
              trialOutcome={trialOutcome}
            />
          ) : null}
        </Box>
      </form>
    </Form>
  )
}
