import { formatCurrency } from '@polar-sh/currency'
import { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic.js'
import { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic.js'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import useDebouncedCallback from '../hooks/debounce'

export interface CheckoutPWYWFormProps {
  update: (data: CheckoutUpdatePublic) => void
  checkout: CheckoutPublic
  productPrice: ProductPriceCustom
  themePreset: ThemingPresetProps
}

export const CheckoutPWYWForm = ({
  update,
  checkout,
  productPrice,
  themePreset,
}: CheckoutPWYWFormProps) => {
  const { amount } = checkout

  const form = useForm<{ amount: number }>({
    defaultValues: { amount: amount || 0 },
  })
  const { control, trigger, reset, watch } = form

  const minimumAmount = productPrice.minimumAmount ?? 50 // should be set, but fallback to 50 for type safety

  const validateAmount = useCallback(
    (value: number): string | true => {
      // Handle gap validation when free is allowed (minimumAmount = 0)
      if (minimumAmount === 0 && value > 0 && value < 50) {
        return `Amount must be $0 or at least ${formatCurrency('presenting')(50, checkout.currency)}`
      }

      if (value < minimumAmount) {
        return `Amount must be at least ${formatCurrency('presenting')(minimumAmount, checkout.currency)}`
      }

      return true
    },
    [minimumAmount, checkout.currency],
  )

  const debouncedAmountUpdate = useDebouncedCallback(
    async (amount: number) => {
      const isValid = await trigger('amount')
      if (isValid) {
        update?.({ amount })
      }
    },
    600,
    [update, trigger],
  )

  useEffect(() => {
    const subscription = watch(async (value, { name }) => {
      if (name === 'amount' && value.amount !== undefined) {
        debouncedAmountUpdate(value.amount)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedAmountUpdate])

  useEffect(() => {
    reset({ amount: amount || 0 })
  }, [amount, reset])

  const minLabelText =
    minimumAmount === 0
      ? null
      : `${formatCurrency('presenting')(minimumAmount, checkout.currency)} minimum`

  return (
    <Form {...form}>
      <form className="flex w-full flex-col gap-3">
        <FormLabel>
          Name a fair price
          {minLabelText && (
            <>
              {' '}
              <span className="text-gray-400">({minLabelText})</span>
            </>
          )}
        </FormLabel>
        <div className="flex flex-row items-center gap-2">
          <FormField
            control={control}
            shouldUnregister={true}
            name="amount"
            rules={{
              validate: validateAmount,
            }}
            render={({ field }) => {
              return (
                <FormItem className="w-full">
                  <MoneyInput
                    className="bg-white shadow-xs"
                    name={field.name}
                    currency={checkout.currency}
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder={0}
                    disabled={field.disabled}
                  />
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </div>
      </form>
    </Form>
  )
}
