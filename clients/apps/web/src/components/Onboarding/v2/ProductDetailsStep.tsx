'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { AUPBlocker } from './AUPBlocker'
import { ChipSelect } from './ChipSelect'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

const SELLING_CATEGORIES = [
  'Software / SaaS',
  'Digital downloads',
  'E-books or courses',
  'Physical products',
  'Services',
  'Other',
] as const

const PRICING_MODELS = [
  'SaaS',
  'Seat-based SaaS',
  'One-time purchase',
  'Usage-based',
  'Combination',
] as const

const SELLING_PLATFORMS = [
  'Paddle',
  'Lemon Squeezy',
  'Gumroad',
  'Stripe',
  'Other',
] as const

interface FormSchema {
  sellingCategories: string[]
  productDescription: string
  pricingModel: string
  meteredCredits: boolean
  currentlySellingOn: string[]
  productWebsite: string
}

export function ProductDetailsStep() {
  const router = useRouter()
  const { data, updateData } = useOnboardingData()

  const form = useForm<FormSchema>({
    defaultValues: {
      sellingCategories: data.sellingCategories || [],
      productDescription: data.productDescription || '',
      pricingModel: data.pricingModel || '',
      meteredCredits: data.meteredCredits || false,
      currentlySellingOn: data.currentlySellingOn || [],
      productWebsite: data.productWebsite || '',
    },
  })

  const { control, handleSubmit, watch, setValue } = form

  const sellingCategories = watch('sellingCategories')
  const pricingModel = watch('pricingModel')

  const currentlySellingOn = watch('currentlySellingOn')

  // Sync visual-relevant fields to context for the animated preview
  useEffect(() => {
    updateData({ sellingCategories, pricingModel, currentlySellingOn })
  }, [sellingCategories, pricingModel, currentlySellingOn, updateData])

  const hasBlockedCategory = useMemo(
    () =>
      sellingCategories.includes('Physical products') ||
      sellingCategories.includes('Services'),
    [sellingCategories],
  )

  const showDescriptionField = useMemo(
    () => sellingCategories.includes('Other'),
    [sellingCategories],
  )

  const showMeteredCredits = useMemo(
    () => pricingModel === 'SaaS' || pricingModel === 'Seat-based SaaS',
    [pricingModel],
  )

  const onSubmit = (formData: FormSchema) => {
    updateData({
      sellingCategories: formData.sellingCategories,
      productDescription: formData.productDescription,
      pricingModel: formData.pricingModel,
      meteredCredits: formData.meteredCredits,
      currentlySellingOn: formData.currentlySellingOn,
      productWebsite: formData.productWebsite,
    })
    router.push('/onboarding/complete')
  }

  return (
    <OnboardingShell
      title="Product Details"
      subtitle="Help us understand what you're building so we can tailor your experience."
      step="product"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <div className="flex flex-col gap-y-3">
            <FormLabel>What are you selling?</FormLabel>
            <ChipSelect
              options={SELLING_CATEGORIES}
              selected={sellingCategories}
              onChange={(val) => setValue('sellingCategories', val)}
            />
          </div>

          {hasBlockedCategory && <AUPBlocker />}

          {showDescriptionField && (
            <FormField
              control={control}
              name="productDescription"
              rules={{
                required: showDescriptionField
                  ? 'Please describe your product'
                  : false,
              }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Describe your product</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="dark:bg-polar-800 dark:border-polar-700 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      rows={3}
                      placeholder="Tell us about what you're selling..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}


          <div className="flex flex-col gap-y-3">
            <FormLabel>Pricing model</FormLabel>
            <ChipSelect
              options={PRICING_MODELS}
              selected={pricingModel ? [pricingModel] : []}
              onChange={(val) => setValue('pricingModel', val[0] || '')}
              single
            />
          </div>

          {showMeteredCredits && (
            <FormField
              control={control}
              name="meteredCredits"
              render={({ field }) => (
                <FormItem className="w-full">
                  <div className="flex items-center justify-between">
                    <FormLabel>Intending to use metered credits?</FormLabel>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </FormItem>
              )}
            />
          )}


          <div className="flex flex-col gap-y-3">
            <FormLabel>
              Currently selling on{' '}
              <span className="dark:text-polar-500 text-gray-400">
                (optional)
              </span>
            </FormLabel>
            <ChipSelect
              options={SELLING_PLATFORMS}
              selected={watch('currentlySellingOn')}
              onChange={(val) => setValue('currentlySellingOn', val)}
            />
          </div>


          <FormField
            control={control}
            name="productWebsite"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>
                  Product Website{' '}
                  <span className="dark:text-polar-500 text-gray-400">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="url"
                    placeholder="https://myproduct.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={hasBlockedCategory || sellingCategories.length === 0}
            fullWidth
          >
            Launch Dashboard
          </Button>
        </form>
      </Form>
    </OnboardingShell>
  )
}
