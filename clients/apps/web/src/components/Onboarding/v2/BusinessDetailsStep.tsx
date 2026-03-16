'use client'

import { useAuth, useOnboardingTracking } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { CurrencySelector } from '../../CurrencySelector'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

interface FormSchema {
  organizationType: 'individual' | 'business'
  orgName: string
  orgSlug: string
  defaultCurrency: string
  businessCountry: string
  registeredBusinessName: string
  ventureBacked: boolean
  mainInvestor: string
  terms: boolean
}

export function BusinessDetailsStep() {
  const router = useRouter()
  const { currentUser, setUserOrganizations } = useAuth()
  const { trackStepCompleted } = useOnboardingTracking()
  const { data, updateData, showApiResponse } = useOnboardingData()
  const createOrganization = useCreateOrganization()
  const [editingSlug, setEditingSlug] = useState(false)

  const form = useForm<FormSchema>({
    defaultValues: {
      organizationType: data.organizationType || 'individual',
      orgName: data.orgName || '',
      orgSlug: data.orgSlug || '',
      defaultCurrency: data.defaultCurrency || 'usd',
      businessCountry: data.businessCountry || '',
      registeredBusinessName: data.registeredBusinessName || '',
      ventureBacked: data.ventureBacked || false,
      mainInvestor: data.mainInvestor || '',
      terms: false,
    },
  })

  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = form

  const organizationType = watch('organizationType')
  const orgName = watch('orgName')
  const orgSlug = watch('orgSlug')
  const defaultCurrency = watch('defaultCurrency')
  const terms = watch('terms')
  const ventureBacked = watch('ventureBacked')
  const mainInvestor = watch('mainInvestor')
  const registeredBusinessName = watch('registeredBusinessName')
  const businessCountry = watch('businessCountry')

  useEffect(() => {
    if (!editingSlug && orgName) {
      setValue('orgSlug', slugify(orgName, { lower: true, strict: true }))
    } else if (orgSlug) {
      setValue(
        'orgSlug',
        slugify(orgSlug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [orgName, editingSlug, orgSlug, setValue])

  useEffect(() => {
    updateData({
      orgName,
      orgSlug,
      defaultCurrency,
      organizationType,
      businessCountry,
      ventureBacked,
      mainInvestor,
      registeredBusinessName,
    })
  }, [
    orgName,
    orgSlug,
    defaultCurrency,
    organizationType,
    businessCountry,
    ventureBacked,
    mainInvestor,
    registeredBusinessName,
    updateData,
  ])

  const onSubmit = async (formData: FormSchema) => {
    if (!formData.terms) return

    updateData({
      organizationType: formData.organizationType,
      orgName: formData.orgName,
      orgSlug: formData.orgSlug,
      defaultCurrency: formData.defaultCurrency,
      businessCountry: formData.businessCountry,
      ventureBacked: formData.ventureBacked,
      mainInvestor: formData.mainInvestor,
      registeredBusinessName: formData.registeredBusinessName,
    })

    const { data: org, error } = await createOrganization.mutateAsync({
      name: formData.orgName,
      slug: formData.orgSlug,
      default_presentment_currency:
        formData.defaultCurrency as schemas['PresentmentCurrency'],
      country: (formData.businessCountry || undefined) as
        | schemas['CountryAlpha2Input']
        | undefined,
    })

    if (error) {
      if (Array.isArray(error.detail)) {
        setError('root', {
          message: error.detail[0]?.msg || 'Failed to create organization',
        })
      } else if (typeof error.detail === 'string') {
        setError('root', { message: error.detail })
      } else {
        setError('root', { message: 'Failed to create organization' })
      }
      return
    }

    setUserOrganizations((prev) => [...prev, org])
    updateData({ organizationId: org.id })

    trackStepCompleted('business')
    await showApiResponse(200, 'OK')
    router.push('/onboarding/product')
  }

  return (
    <OnboardingShell
      title="Business Details"
      subtitle="Tell us about your organization so we can set things up."
      step="business"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <FormField
            control={control}
            name="organizationType"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Using Polar as</FormLabel>
                <FormControl>
                  <Tabs
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (value === 'individual') {
                        setValue('businessCountry', '')
                        setValue('ventureBacked', false)
                        setValue('mainInvestor', '')
                        setValue('registeredBusinessName', '')
                      }
                    }}
                  >
                    <TabsList className="dark:bg-polar-950 w-full flex-row items-center rounded-full bg-gray-100">
                      <TabsTrigger
                        value="individual"
                        className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
                      >
                        Individual
                      </TabsTrigger>
                      <TabsTrigger
                        value="business"
                        className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
                      >
                        Business
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormControl>
              </FormItem>
            )}
          />

          {organizationType === 'business' && (
            <FormField
              control={control}
              name="registeredBusinessName"
              rules={{ required: 'Registered business name is required' }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Registered Business Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acme Corporation Ltd." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Org name with inline slug */}
          <FormField
            control={control}
            name="orgName"
            rules={{ required: 'Organization name is required' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Acme Inc." />
                </FormControl>
                <FormMessage />
                {/* Inline slug preview */}
                <span className="dark:text-polar-500 flex items-center gap-1 text-xs text-gray-400">
                  <span>polar.sh/</span>
                  {editingSlug ? (
                    <input
                      value={orgSlug}
                      onChange={(e) => setValue('orgSlug', e.target.value)}
                      onBlur={() => setEditingSlug(false)}
                      className="dark:text-polar-300 w-32 border-none bg-transparent p-0 text-xs text-gray-600 outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingSlug(true)}
                      className="dark:text-polar-300 dark:hover:text-polar-200 text-gray-600 underline decoration-dotted hover:text-gray-800"
                    >
                      {orgSlug || 'your-slug'}
                    </button>
                  )}
                </span>
              </FormItem>
            )}
          />

          <Box
            display="grid"
            gap="m"
            gridTemplateColumns={
              organizationType === 'business'
                ? 'repeat(2, minmax(0, 1fr))'
                : 'repeat(1, minmax(0, 1fr))'
            }
          >
            <FormField
              control={control}
              name="defaultCurrency"
              rules={{ required: 'Currency is required' }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Default Payment Currency</FormLabel>
                  <FormControl>
                    <CurrencySelector
                      value={field.value as schemas['PresentmentCurrency']}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {organizationType === 'business' && (
              <FormField
                control={control}
                name="businessCountry"
                rules={{
                  required:
                    organizationType === 'business'
                      ? 'Business country is required'
                      : false,
                }}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Business Country</FormLabel>
                    <FormControl>
                      <CountryPicker
                        allowedCountries={enums.addressInputCountryValues}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select country"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </Box>

          {organizationType === 'business' && (
            <>
              <Box display="flex" alignItems="center" justifyContent="between">
                <FormField
                  control={control}
                  name="ventureBacked"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Venture backed?</FormLabel>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />
              </Box>

              {ventureBacked && (
                <FormField
                  control={control}
                  name="mainInvestor"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>
                        Main Investor{' '}
                        <span className="dark:text-polar-500 text-gray-400">
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Sequoia Capital" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          <FormField
            control={control}
            name="terms"
            rules={{ required: 'You must accept the terms to continue' }}
            render={({ field }) => (
              <FormItem>
                <Box
                  display="flex"
                  flexDirection="row"
                  alignItems="start"
                  columnGap="m"
                >
                  <Checkbox
                    id="terms"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      setValue('terms', checked ? true : false)
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-y-1 text-sm">
                    <label
                      htmlFor="terms"
                      className="cursor-pointer leading-snug font-medium"
                    >
                      I agree to Polar&apos;s{' '}
                      <a
                        href="https://polar.sh/legal/terms"
                        className="text-gray-900 underline dark:text-white"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms
                      </a>
                      ,{' '}
                      <a
                        href="https://polar.sh/legal/privacy"
                        className="text-gray-900 underline dark:text-white"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Privacy Policy
                      </a>{' '}
                      &amp;{' '}
                      <a
                        href="https://polar.sh/docs/merchant-of-record/account-reviews"
                        className="text-gray-900 underline dark:text-white"
                        target="_blank"
                        rel="noreferrer"
                      >
                        AUP
                      </a>
                    </label>
                  </div>
                </Box>
                <FormMessage />
              </FormItem>
            )}
          />

          {errors.root && (
            <p className="text-destructive-foreground text-sm">
              {errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            loading={false}
            disabled={orgName.length === 0 || orgSlug.length === 0 || !terms}
            fullWidth
          >
            Continue
          </Button>
        </form>
      </Form>
    </OnboardingShell>
  )
}
