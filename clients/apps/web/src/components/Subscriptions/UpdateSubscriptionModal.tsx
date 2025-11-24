'use client'

import {
  useDiscount,
  useDiscounts,
  useOrganization,
  useProducts,
} from '@/hooks/queries'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import DateTimePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { ProrationBehavior } from '../Settings/ProrationBehavior'
import { toast } from '../Toast/use-toast'

const validationDiscriminators = [
  'SubscriptionUpdateProduct',
  'SubscriptionUpdateDiscount',
  'SubscriptionUpdateTrial',
  'SubscriptionUpdateBillingPeriod',
]

const UpdateProduct = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)
  const { data: organization } = useOrganization(
    subscription.product.organization_id,
  )
  const form = useForm<schemas['SubscriptionUpdateProduct']>({
    defaultValues: {
      proration_behavior: 'prorate',
    },
  })
  const { control, handleSubmit, setError, watch, resetField } = form
  const { data: allProducts } = useProducts(
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
  const products = useMemo(
    () =>
      allProducts
        ? allProducts.items
            .filter((product) => !hasLegacyRecurringPrices(product))
            .filter((product) => {
              // If it's a different product, include it
              if (subscription.product_id !== product.id) {
                return true
              }

              // For the same product, only include if the price sets are different
              const productPriceIds = product.prices.map(({ id }) => id)

              // Check if price sets are identical (same length and same IDs)
              if (productPriceIds.length !== activePriceIds.length) {
                return true
              }
              return !productPriceIds.every((id) => activePriceIds.includes(id))
            })
        : [],
    [allProducts, activePriceIds, subscription],
  )

  const selectedProductId = watch('product_id')
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  )

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateProduct']) => {
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

  // Set default proration behavior from organization settings
  useEffect(() => {
    if (organization) {
      resetField('proration_behavior', {
        defaultValue: organization.subscription_settings.proration_behavior,
      })
    }
  }, [organization, resetField])

  return (
    <Form {...form}>
      <form
        className="flex grow flex-col justify-between gap-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-y-6">
          <FormField
            control={control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New product</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={subscription.status === 'trialing'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a new product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex flex-row items-center justify-between gap-1">
                            {product.name}
                            {product.id === subscription.product_id && (
                              <Pill color="green" className="px-3 py-1 text-xs">
                                New Pricing
                              </Pill>
                            )}
                          </div>
                          <ProductPriceLabel product={product} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                {subscription.status === 'trialing' && (
                  <FormDescription>
                    Product changes are not supported during a trial period
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="proration_behavior"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-y-2">
                <div className="flex flex-col gap-2">
                  <FormLabel>Proration behavior</FormLabel>
                </div>
                <FormControl>
                  <ProrationBehavior
                    value={field.value || 'prorate'}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-4">
          {selectedProduct &&
            selectedProduct.id !== subscription.product.id && (
              <div className="rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
                The customer will get access to {selectedProduct.name} benefits,
                and lose access to {subscription.product.name} benefits.
              </div>
            )}
          <Button
            type="submit"
            size="lg"
            loading={updateSubscription.isPending}
            disabled={
              updateSubscription.isPending || subscription.status === 'trialing'
            }
          >
            Update Subscription
          </Button>
        </div>
      </form>
    </Form>
  )
}

const UpdateDiscount = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)
  const [discountQuery, setDiscountQuery] = useState('')

  const { data: discounts, isLoading: isLoadingDiscounts } = useDiscounts(
    subscription.product.organization_id,
    {
      query: discountQuery || undefined,
      limit: 10,
      sorting: ['name'],
    },
  )

  const { data: selectedDiscount } = useDiscount(
    subscription.product.organization_id,
    subscription.discount_id,
  )

  const form = useForm<schemas['SubscriptionUpdateDiscount']>({
    defaultValues: {
      discount_id: subscription.discount_id || '',
    },
  })
  const { control, handleSubmit, setError } = form

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateDiscount']) => {
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
        <div className="flex flex-col gap-y-6">
          <FormField
            control={control}
            name="discount_id"
            render={({ field }) => {
              const selectedItem =
                selectedDiscount?.id === field.value
                  ? selectedDiscount
                  : discounts?.items.find((d) => d.id === field.value)

              return (
                <FormItem>
                  <FormLabel>Discount</FormLabel>
                  <div className="flex flex-row items-center gap-2">
                    <Combobox
                      items={discounts?.items || []}
                      value={field.value || null}
                      selectedItem={selectedItem || null}
                      onChange={(value) => field.onChange(value || '')}
                      onQueryChange={setDiscountQuery}
                      getItemValue={(discount) => discount.id}
                      getItemLabel={(discount) => discount.name}
                      renderItem={(discount) => (
                        <>
                          {discount.name} ({getDiscountDisplay(discount)})
                        </>
                      )}
                      isLoading={isLoadingDiscounts}
                      placeholder="Select a discount"
                      searchPlaceholder="Search discounts…"
                      emptyLabel="No discounts found"
                      className="flex-1"
                    />
                    {field.value && (
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => field.onChange(null)}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                  <FormDescription>
                    The change will be applied on the next invoice.
                  </FormDescription>
                </FormItem>
              )
            }}
          />
        </div>
        <div className="flex flex-col gap-4">
          <Button
            type="submit"
            size="lg"
            loading={updateSubscription.isPending}
            disabled={updateSubscription.isPending}
          >
            Update Subscription
          </Button>
        </div>
      </form>
    </Form>
  )
}

const UpdateTrial = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)
  const [isEndingTrial, setIsEndingTrial] = useState(false)
  const {
    show: showConfirmModal,
    hide: hideConfirmModal,
    isShown: isConfirmModalShown,
  } = useModal()

  const minDate = useMemo<Date | undefined>(() => {
    if (subscription.status === 'trialing' && subscription.trial_start) {
      return new Date(subscription.trial_start)
    }
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end)
    }
    return undefined
  }, [subscription])

  const form = useForm<schemas['SubscriptionUpdateTrial']>({
    defaultValues: {
      trial_end: subscription.trial_end || undefined,
    },
  })
  const { control, handleSubmit, setError, reset } = form

  const handleEndTrialNow = useCallback(async () => {
    setIsEndingTrial(true)
    try {
      await updateSubscription
        .mutateAsync({ trial_end: 'now' })
        .then(({ error }) => {
          if (error) {
            if (error.detail) {
              if (isValidationError(error.detail)) {
                setValidationErrors(
                  error.detail,
                  setError,
                  undefined,
                  validationDiscriminators,
                )
              } else {
                toast({
                  title: 'Trial end failed',
                  description: `Error while ending trial for ${subscription.product.name}: ${error.detail}`,
                })
              }
            }
            return
          }

          toast({
            title: 'Trial ended',
            description: `Trial for ${subscription.product.name} has been ended. Customer will be billed immediately.`,
          })
          onUpdate?.()
          hideConfirmModal()
        })
    } finally {
      setIsEndingTrial(false)
    }
  }, [updateSubscription, subscription, setError, onUpdate, hideConfirmModal])

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateTrial']) => {
      // Don't submit if trial_end is 'now' - that should use the separate flow
      if (body.trial_end === 'now') {
        return
      }

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
                title: 'Trial update failed',
                description: `Error while updating trial for ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Trial updated',
          description: `Trial for ${subscription.product.name} has been successfully updated`,
        })
        onUpdate?.()
        reset({ trial_end: body.trial_end })
      })
    },
    [updateSubscription, subscription, setError, onUpdate, reset],
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Section 2: Set/Update trial end date */}
        <div className="dark:bg-polar-800 flex flex-col gap-y-4 rounded-2xl bg-gray-50 p-6">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-lg font-medium">
              {subscription.status === 'trialing'
                ? 'Update Trial'
                : 'Add Trial Period'}
            </h3>
            <p className="dark:text-polar-500 mt-1 text-sm text-gray-500">
              {subscription.status === 'trialing'
                ? 'Set a new trial end date to extend or reduce the current trial period.'
                : 'Add a trial period by setting a trial end date in the future.'}
            </p>
          </div>

          <Form {...form}>
            <form
              className="flex flex-col gap-6"
              onSubmit={handleSubmit(onSubmit)}
            >
              <FormField
                control={control}
                name="trial_end"
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-col gap-y-2">
                      <FormLabel>Trial End Date</FormLabel>

                      <DateTimePicker
                        value={field.value === 'now' ? undefined : field.value}
                        onChange={field.onChange}
                        disabled={minDate ? { before: minDate } : undefined}
                      />

                      <FormMessage />
                      {field.value && field.value !== 'now' && (
                        <FormDescription>
                          The trial will end on the selected date and the
                          customer will be charged for the next billing period.
                        </FormDescription>
                      )}
                    </FormItem>
                  )
                }}
              />

              <Button
                type="submit"
                loading={updateSubscription.isPending}
                disabled={updateSubscription.isPending}
                className="w-fit"
              >
                Update Trial
              </Button>
            </form>
          </Form>
        </div>

        {/* Section 1: End trial now */}
        {subscription.status === 'trialing' && (
          <div className="dark:bg-polar-800 flex flex-col items-start gap-y-4 rounded-2xl bg-gray-50 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">End Trial</h3>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                This will immediately end the trial period and charge the
                customer for a new billing cycle.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={showConfirmModal}
              disabled={isEndingTrial}
              loading={isEndingTrial}
            >
              End Trial
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        isShown={isConfirmModalShown}
        hide={hideConfirmModal}
        title="End Trial"
        description="This action will immediately end the trial period and charge the customer for a new billing cycle. This cannot be undone."
        destructive={true}
        destructiveText="End Trial"
        onConfirm={handleEndTrialNow}
        onCancel={hideConfirmModal}
      />
    </>
  )
}

const UpdateBillingPeriod = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)

  const minDate = useMemo<Date | undefined>(() => {
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end)
    }
    return new Date()
  }, [subscription])

  const form = useForm<schemas['SubscriptionUpdateBillingPeriod']>({
    defaultValues: {
      current_billing_period_end: subscription.current_period_end || undefined,
    },
  })
  const { control, handleSubmit, setError } = form

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateBillingPeriod']) => {
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
                title: 'Billing period update failed',
                description: `Error while updating billing period for ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Billing period updated',
          description: `Billing period for ${subscription.product.name} has been successfully updated`,
        })
        onUpdate?.()
      })
    },
    [updateSubscription, subscription, setError, onUpdate],
  )

  return (
    <div className="dark:bg-polar-800 flex flex-col gap-y-4 rounded-2xl bg-gray-50 p-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg font-medium">Update Billing Period</h3>
        <p className="dark:text-polar-500 mt-1 text-sm text-gray-500">
          Extend the current billing period by setting a new end date in the
          future. This is useful for providing additional free subscription time
          to a customer.
        </p>
      </div>

      <Form {...form}>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <FormField
            control={control}
            name="current_billing_period_end"
            render={({ field }) => {
              return (
                <FormItem className="flex flex-col gap-y-2">
                  <FormLabel>Billing Period End Date</FormLabel>

                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={minDate ? { before: minDate } : undefined}
                  />

                  <FormMessage />
                  {field.value && (
                    <FormDescription>
                      The subscription will renew on the selected date and the
                      customer will be charged for the next billing period.
                    </FormDescription>
                  )}
                </FormItem>
              )
            }}
          />

          <Button
            type="submit"
            loading={updateSubscription.isPending}
            disabled={updateSubscription.isPending}
            className="w-fit"
          >
            Update Billing Period
          </Button>
        </form>
      </Form>
    </div>
  )
}

interface UpdateSubscriptionModalProps {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}

const UpdateSubscriptionModal = ({
  subscription,
  onUpdate,
}: UpdateSubscriptionModalProps) => {
  const isActive = useMemo(
    () =>
      subscription.status === 'active' || subscription.status === 'trialing',
    [subscription],
  )
  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Update Subscription</h2>
      </div>
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
            <UpdateProduct subscription={subscription} onUpdate={onUpdate} />
          </div>
        </TabsContent>

        <TabsContent value="discount">
          <div className="flex h-full flex-col gap-4">
            <UpdateDiscount subscription={subscription} onUpdate={onUpdate} />
          </div>
        </TabsContent>

        <TabsContent value="trial">
          <div className="flex h-full flex-col gap-4">
            <UpdateTrial subscription={subscription} onUpdate={onUpdate} />
          </div>
        </TabsContent>

        <TabsContent value="billing-period">
          <div className="flex h-full flex-col gap-4">
            <UpdateBillingPeriod
              subscription={subscription}
              onUpdate={onUpdate}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default UpdateSubscriptionModal
