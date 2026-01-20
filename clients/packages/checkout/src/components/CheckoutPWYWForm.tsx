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
import { formatCurrencyNumber } from '../utils/money'

const DollarSignIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

export interface CheckoutPWYWFormProps {
  update: (data: CheckoutUpdatePublic) => void
  checkout: CheckoutPublic
  productPrice: ProductPriceCustom
  themePreset: ThemingPresetProps
}

const MINIMUM_PRICE_AMOUNT = 50 // Minimum payment amount in cents

export const CheckoutPWYWForm = ({
  update,
  checkout,
  productPrice,
  themePreset,
}: CheckoutPWYWFormProps) => {
  const { amount } = checkout

  // minimumAmount is always set (default 50, or 0 for free-allowed prices)
  const allowFree = productPrice.minimumAmount === 0

  const form = useForm<{ amount: number }>({
    defaultValues: { amount: amount || 0 },
  })
  const { control, trigger, reset, watch } = form

  const validateAmount = useCallback(
    (value: number): string | true => {
      if (allowFree) {
        // Free is allowed: accept $0 or any amount >= MINIMUM_PRICE_AMOUNT
        if (value === 0) {
          return true
        }

        if (value > 0 && value < MINIMUM_PRICE_AMOUNT) {
          return `Amount must be either $0 or more than ${formatCurrencyNumber(MINIMUM_PRICE_AMOUNT, checkout.currency)}`
        }
      } else {
        // Free not allowed: amount must be >= minimumAmount
        if (value < productPrice.minimumAmount) {
          return `Amount must be at least ${formatCurrencyNumber(productPrice.minimumAmount, checkout.currency)}`
        }
      }

      // Check maximum amount (if set)
      if (productPrice.maximumAmount && value > productPrice.maximumAmount) {
        return `Amount must be at most ${formatCurrencyNumber(productPrice.maximumAmount, checkout.currency)}`
      }

      return true
    },
    [
      allowFree,
      productPrice.minimumAmount,
      productPrice.maximumAmount,
      checkout.currency,
    ],
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

  const minLabelText = allowFree
    ? false
    : `${formatCurrencyNumber(productPrice.minimumAmount, checkout.currency)} minimum`

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
                    value={field.value || undefined}
                    onChange={field.onChange}
                    placeholder={0}
                    disabled={field.disabled}
                    preSlot={<DollarSignIcon className="h-4 w-4" />}
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
