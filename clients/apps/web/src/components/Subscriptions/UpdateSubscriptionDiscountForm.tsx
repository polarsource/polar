'use client'

import { useDiscount, useDiscounts } from '@/hooks/queries'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { XIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { subscriptionUpdateValidationDiscriminators } from './utils'

export const UpdateSubscriptionDiscountForm = ({
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

  const form = useForm<schemas['SubscriptionUpdateBase']>({
    defaultValues: {
      discount_id: subscription.discount_id ?? null,
    },
  })
  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty },
  } = form

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
                subscriptionUpdateValidationDiscriminators,
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
                      onChange={(value) => field.onChange(value)}
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
            disabled={!isDirty || updateSubscription.isPending}
          >
            Update Subscription
          </Button>
        </div>
      </form>
    </Form>
  )
}
