'use client'

import { useDiscount, useDiscounts } from '@/hooks/queries'
import { getDiscountDisplay } from '@/utils/discount'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X as XIcon } from '@polar-sh/orbit/icons'
import { Combobox } from '@polar-sh/ui/components/atoms/Combobox'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { Control, useWatch } from 'react-hook-form'
import { isDiscountApplicableToProduct } from './utils'

export const SubscriptionDiscountField = ({
  control,
  subscription,
  targetProductId,
}: {
  control: Control<schemas['SubscriptionUpdateBase']>
  subscription: schemas['Subscription']
  targetProductId: string
}) => {
  const organizationId = subscription.product.organization_id
  const [discountQuery, setDiscountQuery] = useState('')

  const { data: discounts, isLoading } = useDiscounts(organizationId, {
    query: discountQuery || undefined,
    limit: 100,
    sorting: ['name'],
  })
  const selectedDiscountId = useWatch({ control, name: 'discount_id' })
  const { data: selectedDiscount } = useDiscount(
    organizationId,
    selectedDiscountId,
  )

  const applicableDiscounts = (discounts?.items ?? []).filter((discount) =>
    isDiscountApplicableToProduct(discount, targetProductId),
  )

  return (
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
            <Box alignItems="center" columnGap="s">
              <Combobox
                items={applicableDiscounts}
                value={field.value || null}
                selectedItem={selectedItem || null}
                onChange={(value) => {
                  if (value !== null) field.onChange(value)
                }}
                onQueryChange={setDiscountQuery}
                getItemValue={(discount) => discount.id}
                getItemLabel={(discount) => discount.name}
                renderItem={(discount) => (
                  <>
                    {discount.name} ({getDiscountDisplay(discount)})
                  </>
                )}
                isLoading={isLoading}
                placeholder="No discount"
                searchPlaceholder="Search discounts…"
                emptyLabel="No discounts apply to this product"
                className="flex-1"
              />
              {field.value && (
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  aria-label="Remove discount"
                  onClick={() => field.onChange(null)}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </Box>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
