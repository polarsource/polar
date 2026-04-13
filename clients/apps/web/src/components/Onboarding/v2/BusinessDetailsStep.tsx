'use client'

import { useOnboardingV2Tracking } from '@/hooks/onboardingV2'
import { enums, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import Input from '@polar-sh/ui/components/atoms/Input'

import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useFormContext, useWatch } from 'react-hook-form'
import slugify from 'slugify'
import { containsBlockedWord } from '@/utils/blocked-words'
import { CurrencySelector } from '../../CurrencySelector'
import { SUPPORTED_PAYOUT_COUNTRIES } from './config/supported-payout-countries'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

interface FormSchema {
  organizationType: 'individual' | 'company'
  orgName: string
  orgSlug: string
  defaultCurrency: string
  businessCountry: string
  registeredBusinessName: string
}

function FormSync() {
  const { updateData } = useOnboardingData()
  const values = useWatch<FormSchema>()

  useEffect(() => {
    updateData({
      orgName: values.orgName,
      orgSlug: values.orgSlug,
      defaultCurrency: values.defaultCurrency,
      organizationType: values.organizationType,
      businessCountry: values.businessCountry,
      registeredBusinessName: values.registeredBusinessName,
    })
  }, [values, updateData])

  return null
}

function OrgNameSync({
  editedSlug,
  editedBusinessName,
}: {
  editedSlug: boolean
  editedBusinessName: boolean
}) {
  const { setValue } = useFormContext<FormSchema>()
  const orgName = useWatch<FormSchema, 'orgName'>({ name: 'orgName' })

  useEffect(() => {
    if (!editedSlug && orgName) {
      setValue('orgSlug', slugify(orgName, { lower: true, strict: true }))
    }
  }, [orgName, editedSlug, setValue])

  useEffect(() => {
    if (!editedBusinessName && orgName) {
      setValue('registeredBusinessName', orgName)
    }
  }, [orgName, editedBusinessName, setValue])

  return null
}

function CompanyFields({
  onEditBusinessName,
}: {
  onEditBusinessName: () => void
}) {
  const organizationType = useWatch<FormSchema, 'organizationType'>({
    name: 'organizationType',
  })

  if (organizationType !== 'company') return null

  return (
    <FormField
      name="registeredBusinessName"
      rules={{ required: 'Registered business name is required' }}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel>Registered Business Name</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="Acme Corporation Ltd."
              onChange={(e) => {
                field.onChange(e)
                onEditBusinessName()
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CurrencyAndCountryFields() {
  const organizationType = useWatch<FormSchema, 'organizationType'>({
    name: 'organizationType',
  })
  const businessCountry = useWatch<FormSchema, 'businessCountry'>({
    name: 'businessCountry',
  })

  const isUnsupportedCountry =
    businessCountry !== '' &&
    !SUPPORTED_PAYOUT_COUNTRIES.includes(businessCountry)

  const countryDisplayName = useMemo(() => {
    if (!businessCountry) return ''
    return (
      new Intl.DisplayNames([], { type: 'region' }).of(businessCountry) ??
      businessCountry
    )
  }, [businessCountry])

  return (
    <div className="flex flex-col gap-y-2">
      <Box
        display="grid"
        gap="m"
        gridTemplateColumns={
          organizationType === 'company'
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(1, minmax(0, 1fr))'
        }
      >
        <FormField
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

        {organizationType === 'company' && (
          <FormField
            name="businessCountry"
            rules={{ required: 'Business country is required' }}
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

      {organizationType === 'company' && isUnsupportedCountry && (
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
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Payouts are not available in {countryDisplayName}&nbsp;yet. You can
            still continue and we&rsquo;ll notify you when support is added.
          </p>
        </Box>
      )}
    </div>
  )
}

function SubmitButton({ loading }: { loading: boolean }) {
  const orgName = useWatch<FormSchema, 'orgName'>({ name: 'orgName' })
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })
  return (
    <Button
      type="submit"
      loading={loading}
      disabled={orgName.length === 0 || orgSlug.length === 0}
      fullWidth
    >
      Continue
    </Button>
  )
}

export function BusinessDetailsStep() {
  const router = useRouter()
  const { trackStepViewed, trackStepCompleted } = useOnboardingV2Tracking()
  const { data, updateData, setApiLoading, showApiResponse } =
    useOnboardingData()
  const [submitting, setSubmitting] = useState(false)

  trackStepViewed('business')
  const [editedSlug, setEditedSlug] = useState(
    () =>
      (data.orgSlug ?? '') !==
      slugify(data.orgName ?? '', { lower: true, strict: true }),
  )
  const [editedBusinessName, setEditedBusinessName] = useState(
    () => (data.registeredBusinessName ?? '') !== (data.orgName ?? ''),
  )

  const form = useForm<FormSchema>({
    defaultValues: {
      organizationType: data.organizationType || 'individual',
      orgName: data.orgName || '',
      orgSlug: data.orgSlug || '',
      defaultCurrency: data.defaultCurrency || 'usd',
      businessCountry: data.businessCountry || '',
      registeredBusinessName: data.registeredBusinessName || '',
    },
  })

  const { handleSubmit, setValue } = form

  const onSubmit = async (formData: FormSchema) => {
    setSubmitting(true)
    setApiLoading(true)

    updateData({
      organizationType: formData.organizationType,
      orgName: formData.orgName,
      orgSlug: formData.orgSlug,
      defaultCurrency: formData.defaultCurrency,
      businessCountry: formData.businessCountry,
      registeredBusinessName: formData.registeredBusinessName,
    })

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
          <FormSync />
          <OrgNameSync
            editedSlug={editedSlug}
            editedBusinessName={editedBusinessName}
          />

          <FormField
            control={form.control}
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
                        value="company"
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="orgName"
              rules={{
                required: 'Organization name is required',
                validate: (v) =>
                  !containsBlockedWord(v) || 'This name is not allowed.',
              }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acme Inc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orgSlug"
              rules={{
                required: 'Slug is required',
                validate: (v) =>
                  !containsBlockedWord(v) || 'This slug is not allowed.',
              }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Organization Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="acme-inc"
                      onChange={(e) => {
                        field.onChange(
                          slugify(e.target.value, {
                            lower: true,
                            trim: false,
                            strict: true,
                          }),
                        )
                        setEditedSlug(true)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <CompanyFields
            onEditBusinessName={() => setEditedBusinessName(true)}
          />

          <CurrencyAndCountryFields />

          <SubmitButton loading={submitting} />
        </form>
      </Form>
    </OnboardingShell>
  )
}
