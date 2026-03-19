/* eslint-disable max-lines */
'use client'

import { useAuth, useOnboardingTracking } from '@/hooks'
import { useCreateOrganization, useUpdateOrganization } from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import Input from '@polar-sh/ui/components/atoms/Input'

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
import { useForm, useFormContext, useWatch } from 'react-hook-form'
import slugify from 'slugify'
import { CurrencySelector } from '../../CurrencySelector'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

interface FormSchema {
  organizationType: 'individual' | 'company'
  orgName: string
  orgSlug: string
  defaultCurrency: string
  businessCountry: string
  registeredBusinessName: string
  terms: boolean
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

function SlugPreview({
  editingSlug,
  setEditingSlug,
  onEditSlug,
}: {
  editingSlug: boolean
  setEditingSlug: (v: boolean) => void
  onEditSlug: () => void
}) {
  const { setValue } = useFormContext<FormSchema>()
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })

  return (
    <span className="dark:text-polar-500 flex items-center gap-1 text-xs text-gray-400">
      <span>polar.sh/</span>
      {editingSlug ? (
        <input
          value={orgSlug}
          onChange={(e) => {
            setValue(
              'orgSlug',
              slugify(e.target.value, {
                lower: true,
                trim: false,
                strict: true,
              }),
            )
            onEditSlug()
          }}
          onBlur={() => setEditingSlug(false)}
          className="dark:text-polar-300 rounded border-none bg-transparent p-0 text-xs text-gray-600 outline-none"
          style={{ width: `${Math.max(orgSlug.length, 8)}ch` }}
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
  )
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

  return (
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
  )
}

function SubmitButton({ loading }: { loading: boolean }) {
  const orgName = useWatch<FormSchema, 'orgName'>({ name: 'orgName' })
  const orgSlug = useWatch<FormSchema, 'orgSlug'>({ name: 'orgSlug' })
  const terms = useWatch<FormSchema, 'terms'>({ name: 'terms' })

  return (
    <Button
      type="submit"
      loading={loading}
      disabled={orgName.length === 0 || orgSlug.length === 0 || !terms}
      fullWidth
    >
      Continue
    </Button>
  )
}

export function BusinessDetailsStep() {
  const router = useRouter()
  const { setUserOrganizations } = useAuth()
  const { trackStepCompleted } = useOnboardingTracking()
  const { data, updateData, showApiResponse } = useOnboardingData()
  const createOrganization = useCreateOrganization()
  const updateOrganization = useUpdateOrganization()
  const [submitting, setSubmitting] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [editedSlug, setEditedSlug] = useState(false)
  const [editedBusinessName, setEditedBusinessName] = useState(false)

  const form = useForm<FormSchema>({
    defaultValues: {
      organizationType: data.organizationType || 'individual',
      orgName: data.orgName || '',
      orgSlug: data.orgSlug || '',
      defaultCurrency: data.defaultCurrency || 'usd',
      businessCountry: data.businessCountry || '',
      registeredBusinessName: data.registeredBusinessName || '',
      terms: false,
    },
  })

  const {
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = form

  const onSubmit = async (formData: FormSchema) => {
    if (!formData.terms) return
    setSubmitting(true)

    updateData({
      organizationType: formData.organizationType,
      orgName: formData.orgName,
      orgSlug: formData.orgSlug,
      defaultCurrency: formData.defaultCurrency,
      businessCountry: formData.businessCountry,
      registeredBusinessName: formData.registeredBusinessName,
    })

    const orgBody = {
      name: formData.orgName,
      slug: formData.orgSlug,
      default_presentment_currency:
        formData.defaultCurrency as schemas['PresentmentCurrency'],
      country: (formData.businessCountry || undefined) as
        | schemas['CountryAlpha2Input']
        | undefined,
      legal_entity:
        formData.organizationType === 'company'
          ? {
              type: 'company' as const,
              registered_name: formData.registeredBusinessName,
            }
          : { type: 'individual' as const },
    }

    if (data.organizationId) {
      const { error } = await updateOrganization.mutateAsync({
        id: data.organizationId,
        body: orgBody,
      })

      if (error) {
        setSubmitting(false)
        setError('root', { message: 'Failed to update organization' })
        return
      }
    } else {
      const { data: org, error } = await createOrganization.mutateAsync(orgBody)

      if (error) {
        setSubmitting(false)
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
    }

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

          <FormField
            control={form.control}
            name="orgName"
            rules={{ required: 'Organization name is required' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Acme Inc." />
                </FormControl>
                <FormMessage />
                <SlugPreview
                  editingSlug={editingSlug}
                  setEditingSlug={setEditingSlug}
                  onEditSlug={() => setEditedSlug(true)}
                />
              </FormItem>
            )}
          />

          <CompanyFields
            onEditBusinessName={() => setEditedBusinessName(true)}
          />
          <CurrencyAndCountryFields />

          <FormField
            control={form.control}
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
                        href="https://polar.sh/legal/master-services-terms"
                        className="text-gray-900 underline dark:text-white"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms
                      </a>
                      ,{' '}
                      <a
                        href="https://polar.sh/legal/privacy-policy"
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

          <SubmitButton loading={submitting} />
        </form>
      </Form>
    </OnboardingShell>
  )
}
