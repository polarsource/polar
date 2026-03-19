/* eslint-disable max-lines */
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
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
  const params = useParams<{ organization: string }>()
  const { data, updateData, showApiResponse } = useOnboardingData()
  const updateOrganization = useUpdateOrganization()
  const [loading, setLoading] = useState<
    'validating' | 'submitting' | 'submitting-anyway' | null
  >(null)
  const [aupVerdict, setAupVerdict] = useState<'DENY' | 'CLARIFY' | null>(null)
  const [aupMessage, setAupMessage] = useState<string | null>(null)
  const [aupHistory, setAupHistory] = useState<
    Array<{ product_description: string; verdict: string; message?: string }>
  >([])

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

  // eslint-disable-next-line react-hooks/incompatible-library
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

  const submitOrg = async (formData: FormSchema) => {
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

      const { error } = await updateOrganization.mutateAsync({
        id: data.organizationId,
        body: {
          ...(formData.supportEmail && { email: formData.supportEmail }),
          ...(formData.productUrl && { website: formData.productUrl }),
          details: {
            about: '-',
            product_description: formData.productDescription,
            selling_categories: formData.sellingCategories,
            pricing_models: formData.pricingModel,
            switching,
            switching_from: switchingFrom,
          } satisfies schemas['OrganizationDetails'],
        },
      })

      if (error) {
        return false
      }
    }

    await showApiResponse(200, 'OK')
    router.push('/onboarding/complete')
    return true
  }

  const onSubmit = async (formData: FormSchema) => {
    setLoading('validating')

    const res = await fetch(
      `/dashboard/${params.organization}/onboarding/validate-description`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_description: formData.productDescription,
          selling_categories: formData.sellingCategories,
          pricing_models: formData.pricingModel,
          history: aupHistory,
        }),
      },
    )

    const validation: {
      verdict: 'APPROVE' | 'DENY' | 'CLARIFY'
      confidence: number
      message?: string
    } = await res.json()

    if (validation.verdict === 'DENY' || validation.verdict === 'CLARIFY') {
      setAupHistory((prev) => [
        ...prev,
        {
          product_description: formData.productDescription,
          verdict: validation.verdict,
          message: validation.message,
        },
      ])
      setAupVerdict(validation.verdict)
      setAupMessage(validation.message ?? null)
      setLoading(null)
      return
    }

    console.log(validation)

    setAupVerdict(null)
    setAupMessage(null)
    setLoading('submitting')
    // const success = await submitOrg(formData)
    // if (!success) {
    setLoading(null)
    // }
  }

  const onContinueAnyway = async () => {
    setLoading('submitting-anyway')
    const formData = form.getValues()
    const success = await submitOrg(formData)
    if (!success) {
      setLoading(null)
    }
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

          {aupVerdict === 'CLARIFY' && (
            <Box
              display="flex"
              flexDirection="column"
              rowGap="m"
              borderRadius="md"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-warning"
              backgroundColor="background-warning"
              padding="l"
            >
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Please clarify your use case
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {aupMessage}
              </p>
            </Box>
          )}

          {aupVerdict === 'DENY' && (
            <Box
              display="flex"
              flexDirection="column"
              rowGap="m"
              borderRadius="md"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-warning"
              backgroundColor="background-warning"
              padding="l"
            >
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Use case not supported
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {aupMessage}
              </p>
            </Box>
          )}

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
            gridTemplateColumns={{
              base: 'repeat(1, minmax(0, 1fr))',
              md: 'repeat(2, minmax(0, 1fr))',
            }}
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

          <div className="flex flex-col gap-y-2">
            <Button
              type="submit"
              loading={loading === 'validating' || loading === 'submitting'}
              disabled={
                loading === 'submitting-anyway' ||
                blockedSelected.length > 0 ||
                sellingCategories.length === 0 ||
                pricingModel.length === 0 ||
                productDescription.trim().length === 0
              }
              fullWidth
            >
              {aupVerdict ? 'Review again' : 'Launch Dashboard'}
            </Button>

            {aupVerdict === 'CLARIFY' &&
              aupHistory.length >= 3 &&
              productDescription.trim().length > 30 &&
              loading !== 'validating' && (
                <Button
                  variant="ghost"
                  type="button"
                  fullWidth
                  onClick={onContinueAnyway}
                  disabled={loading === 'submitting'}
                  loading={loading === 'submitting-anyway'}
                >
                  Continue without review
                </Button>
              )}
          </div>
        </form>
      </Form>
    </OnboardingShell>
  )
}
