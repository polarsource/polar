'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  Form,
  FormControl,
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
  { name: 'Software / SaaS', prohibited: false },
  { name: 'Digital downloads', prohibited: false },
  { name: 'E-books or courses', prohibited: false },
  { name: 'Physical products', prohibited: true },
  { name: 'Services', prohibited: true },
  { name: 'Financial Trading', prohibited: true },
  { name: 'Advertising', prohibited: true },
  { name: 'Marketplace', prohibited: true },
  { name: 'Other', prohibited: false },
] as const

const PRICING_MODELS = [
  'Subscription',
  'Seat-based subscription',
  'One-time purchase',
  'Usage-based',
] as const

const SELLING_PLATFORMS: [
  NonNullable<schemas['OrganizationDetails']['switching_from']>,
  string,
][] = [
  ['paddle', 'Paddle'],
  ['lemon_squeezy', 'Lemon Squeezy'],
  ['gumroad', 'Gumroad'],
  ['stripe', 'Stripe'],
  ['other', 'Other'],
]

interface FormSchema {
  sellingCategories: string[]
  productDescription: string
  pricingModel: string[]
  supportEmail: string
  productUrl: string
  currentlySellingOn: string[]
}

export function ProductDetailsStep() {
  const router = useRouter()
  const { data, updateData, showApiResponse } = useOnboardingData()
  const updateOrganization = useUpdateOrganization()

  const form = useForm<FormSchema>({
    defaultValues: {
      sellingCategories: data.sellingCategories || [],
      productDescription: data.productDescription || '',
      pricingModel: data.pricingModel || [],
      supportEmail: data.supportEmail || '',
      productUrl: data.productUrl || '',
      currentlySellingOn: data.currentlySellingOn || [],
    },
  })

  const { control, handleSubmit, watch, setValue } = form

  const sellingCategories = watch('sellingCategories')
  const pricingModel = watch('pricingModel')
  const productDescription = watch('productDescription')
  const supportEmail = watch('supportEmail')
  const productUrl = watch('productUrl')
  const currentlySellingOn = watch('currentlySellingOn')

  useEffect(() => {
    updateData({
      sellingCategories,
      pricingModel,
      productDescription,
      supportEmail,
      productUrl,
      currentlySellingOn,
    })
  }, [
    sellingCategories,
    pricingModel,
    productDescription,
    supportEmail,
    productUrl,
    currentlySellingOn,
    updateData,
  ])

  const blockedSelected = useMemo(
    () =>
      sellingCategories.filter((name) =>
        SELLING_CATEGORIES.some((c) => c.name === name && c.prohibited),
      ),
    [sellingCategories],
  )

  const onSubmit = async (formData: FormSchema) => {
    updateData({
      sellingCategories: formData.sellingCategories,
      productDescription: formData.productDescription,
      pricingModel: formData.pricingModel,
      supportEmail: formData.supportEmail,
      productUrl: formData.productUrl,
      currentlySellingOn: formData.currentlySellingOn,
    })

    if (data.organizationId) {
      const switching = formData.currentlySellingOn.length > 0
      const switchingFrom = (
        switching ? formData.currentlySellingOn[0] : null
      ) as schemas['OrganizationDetails']['switching_from']

      const productDescriptionParts = [
        formData.sellingCategories.length > 0 &&
          `Product type: ${formData.sellingCategories.join(', ')}`,
        formData.pricingModel.length > 0 &&
          `Pricing model: ${formData.pricingModel.join(', ')}`,
        '',
        formData.productDescription,
      ]
        .filter((part) => part !== false)
        .join('\n')
        .trim()

      await updateOrganization.mutateAsync({
        id: data.organizationId,
        body: {
          ...(formData.supportEmail && { email: formData.supportEmail }),
          ...(formData.productUrl && { website: formData.productUrl }),
          details: {
            about: '-',
            intended_use: '-',
            customer_acquisition: [],
            future_annual_revenue: 0,
            previous_annual_revenue: 0,
            product_description: productDescriptionParts,
            switching,
            switching_from: switchingFrom,
          } satisfies schemas['OrganizationDetails'],
        },
      })
    }

    await showApiResponse(200, 'OK')
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
          <Box display="flex" flexDirection="column" rowGap="m">
            <FormLabel>What are you selling?</FormLabel>
            <ChipSelect
              options={SELLING_CATEGORIES.map((c) => c.name)}
              selected={sellingCategories}
              onChange={(val) => setValue('sellingCategories', val)}
            />
          </Box>

          {blockedSelected.length > 0 && (
            <AUPBlocker categories={blockedSelected} />
          )}

          <FormField
            control={control}
            name="productDescription"
            rules={{ required: 'Please describe your product' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Describe your product</FormLabel>
                <FormControl>
                  <TextArea
                    {...field}
                    resizable={false}
                    placeholder="Tell us about what you're selling..."
                    className="min-h-10 rounded-xl px-3 py-2.5"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Box display="flex" flexDirection="column" rowGap="m">
            <FormLabel>Pricing model</FormLabel>
            <ChipSelect
              options={PRICING_MODELS}
              selected={pricingModel}
              onChange={(val) => setValue('pricingModel', val)}
            />
          </Box>

          <Box display="flex" flexDirection="column" rowGap="m">
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
          </Box>

          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="m"
          >
            <FormField
              control={control}
              name="supportEmail"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>
                    Support Email{' '}
                    <span className="dark:text-polar-500 text-gray-400">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="support@example.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="productUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>
                    Product URL{' '}
                    <span className="dark:text-polar-500 text-gray-400">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://example.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Box>

          <Button
            type="submit"
            disabled={
              blockedSelected.length > 0 ||
              sellingCategories.length === 0 ||
              pricingModel.length === 0 ||
              productDescription.trim().length === 0
            }
            fullWidth
          >
            Launch Dashboard
          </Button>
        </form>
      </Form>
    </OnboardingShell>
  )
}
