'use client'

import { useCheckoutForm } from '@polar-sh/checkout/providers'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutUpdatePublic } from '@polar-sh/sdk/models/components/checkoutupdatepublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useState } from 'react'

const XIcon = ({ className }: { className?: string }) => {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

interface CheckoutDiscountInputProps {
  checkout: CheckoutPublic
  update: (data: CheckoutUpdatePublic) => Promise<CheckoutPublic>
  locale?: AcceptedLocale
  collapsible?: boolean
}

export const CheckoutDiscountInput = ({
  checkout,
  update,
  locale = DEFAULT_LOCALE,
  collapsible = false,
}: CheckoutDiscountInputProps) => {
  const t = useTranslations(locale)
  const [expanded, setExpanded] = useState(false)
  const { form } = useCheckoutForm()
  const { control, setValue, clearErrors, watch } = form

  const hasDiscount = !!checkout.discount

  const discountCode = watch('discountCode')

  const addDiscountCode = useCallback(async () => {
    if (!discountCode) return
    clearErrors('discountCode')
    await update({ discountCode })
  }, [update, discountCode, clearErrors])

  const removeDiscountCode = useCallback(async () => {
    clearErrors('discountCode')
    setValue('discountCode', null)
    await update({ discountCode: null })
    setExpanded(false)
  }, [update, clearErrors, setValue])

  if (!checkout.allowDiscountCodes || !checkout.isDiscountApplicable) {
    return null
  }

  if (collapsible && !hasDiscount && !expanded) {
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setExpanded(true)}
        >
          {t('checkout.form.addDiscountCode')}
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <div className="flex flex-col gap-1">
        {!collapsible && (
          <label className="flex flex-row items-center justify-between text-sm">
            <span>{t('checkout.form.discountCode')}</span>
            <span className="dark:text-polar-500 text-xs font-normal text-gray-500">
              {t('checkout.form.optional')}
            </span>
          </label>
        )}
        <FormField
          control={control}
          name="discountCode"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Input
                    type="text"
                    autoComplete="off"
                    placeholder={
                      collapsible ? t('checkout.form.discountCode') : undefined
                    }
                    {...field}
                    value={field.value || ''}
                    disabled={hasDiscount}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      addDiscountCode()
                    }}
                  />
                  <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                    {!hasDiscount && discountCode && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addDiscountCode}
                        className={collapsible ? 'h-6 px-2 text-xs' : undefined}
                      >
                        {t('checkout.form.apply')}
                      </Button>
                    )}
                    {hasDiscount && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={removeDiscountCode}
                        className={collapsible ? 'h-6 w-6 px-0' : undefined}
                      >
                        <XIcon
                          className={collapsible ? 'h-3 w-3' : 'h-4 w-4'}
                        />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  )
}
