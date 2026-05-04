'use client'

import { useAuth } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
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
import { setValidationErrors } from '@/utils/api/errors'
import slugify from 'slugify'
import { containsBlockedWord } from '@/utils/blocked-words'
import { CurrencySelector } from '../CurrencySelector'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

interface FormSchema {
  organizationType: 'individual' | 'company'
  name: string
  slug: string
  default_presentment_currency: string
  country: string
  legal_entity: {
    registered_name: string
  }
}

function FormSync() {
  const { updateData } = useOnboardingData()
  const values = useWatch<FormSchema>()

  useEffect(() => {
    updateData({
      orgName: values.name,
      orgSlug: values.slug,
      defaultCurrency: values.default_presentment_currency,
      organizationType: values.organizationType,
      businessCountry: values.country,
      registeredBusinessName: values.legal_entity?.registered_name,
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
  const name = useWatch<FormSchema, 'name'>({ name: 'name' })

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    }
  }, [name, editedSlug, setValue])

  useEffect(() => {
    if (!editedBusinessName && name) {
      setValue('legal_entity.registered_name', name)
    }
  }, [name, editedBusinessName, setValue])

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
      name="legal_entity.registered_name"
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
  const country = useWatch<FormSchema, 'country'>({
    name: 'country',
  })

  const isUnsupportedCountry =
    country !== '' &&
    !(enums.stripeAccountCountryValues as readonly string[]).includes(country)

  const countryDisplayName = useMemo(() => {
    if (!country) return ''
    return new Intl.DisplayNames([], { type: 'region' }).of(country) ?? country
  }, [country])

  return (
    <Box display="flex" flexDirection="column" rowGap="s">
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
          name="default_presentment_currency"
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
            name="country"
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
          borderRadius="m"
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
    </Box>
  )
}

function SubmitButton({ loading }: { loading: boolean }) {
  const name = useWatch<FormSchema, 'name'>({ name: 'name' })
  const slug = useWatch<FormSchema, 'slug'>({ name: 'slug' })
  return (
    <Button
      type="submit"
      loading={loading}
      disabled={name.length === 0 || slug.length === 0}
      fullWidth
    >
      Continue
    </Button>
  )
}

export function BusinessDetailsStep() {
  const router = useRouter()
  const { setUserOrganizations } = useAuth()
  const { trackStepViewed, trackStepCompleted } = useOnboardingV2Tracking()
  const { data, updateData, setApiLoading, showApiResponse } =
    useOnboardingData()
  const createOrganization = useCreateOrganization()
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
      name: data.orgName || '',
      slug: data.orgSlug || '',
      default_presentment_currency: data.defaultCurrency || 'usd',
      country: data.businessCountry || '',
      legal_entity: {
        registered_name: data.registeredBusinessName || '',
      },
    },
  })

  const { handleSubmit, setError, setValue } = form

  const onSubmit = async (formData: FormSchema) => {
    setSubmitting(true)
    setApiLoading(true)

    updateData({
      organizationType: formData.organizationType,
      orgName: formData.name,
      orgSlug: formData.slug,
      defaultCurrency: formData.default_presentment_currency,
      businessCountry: formData.country,
      registeredBusinessName: formData.legal_entity.registered_name,
    })

    const { data: organization, error } = await createOrganization.mutateAsync({
      name: formData.name,
      slug: formData.slug,
      default_presentment_currency:
        formData.default_presentment_currency as schemas['PresentmentCurrency'],
      country: (formData.country || undefined) as
        | schemas['OrganizationCreate']['country']
        | undefined,
      default_tax_behavior: 'location',
      legal_entity:
        formData.organizationType === 'company'
          ? {
              type: 'company' as const,
              registered_name: formData.legal_entity.registered_name,
            }
          : { type: 'individual' as const },
    })

    if (error) {
      setSubmitting(false)
      if (Array.isArray(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', {
          message:
            typeof error.detail === 'string'
              ? error.detail
              : 'Failed to create organization',
        })
      }
      await showApiResponse(400, 'Failed to create organization')
      return
    }

    setUserOrganizations((previous) => [...previous, organization])
    updateData({
      organizationId: organization.id,
      orgSlug: organization.slug,
    })

    trackStepCompleted('business', { organization_id: organization.id })
    await showApiResponse(201, 'Created')
    router.push('/onboarding/product')
  }

  return (
    <OnboardingShell
      title="Business Details"
      subtitle="Tell us about your organization so we can set things up."
      step="business"
    >
      <Form {...form}>
        <Box
          as="form"
          onSubmit={handleSubmit(onSubmit)}
          display="flex"
          flexDirection="column"
          rowGap="xl"
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
                        setValue('country', '')
                        setValue('legal_entity.registered_name', '')
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

          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="l"
          >
            <FormField
              control={form.control}
              name="name"
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
              name="slug"
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
          </Box>

          <CompanyFields
            onEditBusinessName={() => setEditedBusinessName(true)}
          />

          <CurrencyAndCountryFields />

          {form.formState.errors.root && (
            <p className="text-sm text-red-500 dark:text-red-500">
              {form.formState.errors.root.message}
            </p>
          )}

          <SubmitButton loading={submitting} />
        </Box>
      </Form>
    </OnboardingShell>
  )
}
