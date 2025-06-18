'use client'

import { useDiscounts, useOrganization, useProducts } from '@/hooks/queries'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import { hasLegacyRecurringPrices } from '@/utils/product'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
import { useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { ProrationBehavior } from '../Settings/ProrationBehavior'
import { toast } from '../Toast/use-toast'

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
  const products = useMemo(
    () =>
      allProducts
        ? allProducts.items.filter(
            (product) => !hasLegacyRecurringPrices(product),
          )
        : [],
    [allProducts],
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
              setValidationErrors(error.detail, setError)
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
        className="flex flex-grow flex-col justify-between gap-y-6"
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
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a new product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter(
                          (product) => product.id !== subscription.product_id,
                        )
                        .map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            disabled={product.id === subscription.product_id}
                          >
                            <div>{product.name}</div>
                            <ProductPriceLabel product={product} />
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormControl>
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
            disabled={updateSubscription.isPending}
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

  const { data: discounts } = useDiscounts(
    subscription.product.organization_id,
    {
      limit: 100,
      sorting: ['name'],
    },
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
              setValidationErrors(error.detail, setError)
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
        className="flex flex-grow flex-col justify-between gap-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-y-6">
          {(discounts?.items.length ?? 0) > 0 && (
            <FormField
              control={control}
              name="discount_id"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <div className="flex flex-row items-center gap-2">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a discount" />
                        </SelectTrigger>
                        <SelectContent>
                          {discounts?.items.map((discount) => (
                            <SelectItem
                              key={discount.id}
                              value={discount.id}
                              textValue={discount.name}
                            >
                              {discount.name} ({getDiscountDisplay(discount)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
          )}
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

interface UpdateSubscriptionModalProps {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}

const UpdateSubscriptionModal = ({
  subscription,
  onUpdate,
}: UpdateSubscriptionModalProps) => {
  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Update Subscription</h2>
      </div>
      <Tabs defaultValue="product">
        <TabsList className="mb-8">
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="discount">Discount</TabsTrigger>
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
      </Tabs>
    </div>
  )
}

export default UpdateSubscriptionModal
