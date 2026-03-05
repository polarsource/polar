'use client'

import revalidate from '@/app/actions'
import { useAuth, useOnboardingTracking } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Switch from '@polar-sh/ui/components/atoms/Switch'
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
import { COUNTRIES } from './countries'

const TEAM_SIZES = ['Just me', '2-5', '5-20', '20-50', '50+'] as const

interface FormSchema {
  organizationType: 'individual' | 'business'
  orgName: string
  orgSlug: string
  defaultCurrency: string
  website: string
  supportEmail: string
  businessCountry: string
  teamSize: string
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
      website: data.website || '',
      supportEmail: data.supportEmail || '',
      businessCountry: data.businessCountry || '',
      teamSize: data.teamSize || '',
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
  const website = watch('website')
  const supportEmail = watch('supportEmail')
  const mainInvestor = watch('mainInvestor')

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

  const businessCountry = watch('businessCountry')
  const teamSize = watch('teamSize')

  // Sync visual-relevant fields to context for the animated preview
  useEffect(() => {
    updateData({
      orgName,
      orgSlug,
      defaultCurrency,
      organizationType,
      businessCountry,
      teamSize,
      website,
      supportEmail,
      ventureBacked,
      mainInvestor,
    })
  }, [orgName, orgSlug, defaultCurrency, organizationType, businessCountry, teamSize, website, supportEmail, ventureBacked, mainInvestor, updateData])

  const onSubmit = async (formData: FormSchema) => {
    if (!formData.terms) return

    updateData({
      organizationType: formData.organizationType,
      orgName: formData.orgName,
      orgSlug: formData.orgSlug,
      defaultCurrency: formData.defaultCurrency,
      website: formData.website,
      supportEmail: formData.supportEmail,
      businessCountry: formData.businessCountry,
      teamSize: formData.teamSize,
      ventureBacked: formData.ventureBacked,
      mainInvestor: formData.mainInvestor,
    })

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
                  <div className="flex gap-2">
                    {(['individual', 'business'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          field.onChange(type)
                          if (type === 'individual') {
                            setValue('businessCountry', '')
                            setValue('teamSize', '')
                            setValue('ventureBacked', false)
                            setValue('mainInvestor', '')
                          }
                        }}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          field.value === type
                            ? 'border-blue-500 bg-blue-500 font-medium text-white'
                            : 'dark:border-polar-600 dark:text-polar-300 dark:hover:border-polar-400 border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {type === 'individual' ? 'Individual' : 'Business'}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />


          {/* Org name with inline slug */}
          <FormField
            control={control}
            name="orgName"
            rules={{ required: 'Organization name is required' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>
                  {organizationType === 'business'
                    ? 'Registered Business Name'
                    : 'Organization Name'}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Acme Inc." />
                </FormControl>
                <FormMessage />
                {/* Inline slug preview */}
                <div className="dark:text-polar-500 flex items-center gap-1 text-xs text-gray-400">
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
                </div>
              </FormItem>
            )}
          />

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

          {/* Website + Support Email side by side */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={control}
              name="website"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>
                    Website{' '}
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
          </div>

          {organizationType === 'business' && (
            <>
    
              {/* Business Country + Team Size side by side */}
              <div className="grid grid-cols-2 gap-3">
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
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="teamSize"
                  rules={{
                    required:
                      organizationType === 'business'
                        ? 'Team size is required'
                        : false,
                  }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Team Size</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_SIZES.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between">
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
              </div>

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
                <div className="flex flex-row items-start gap-x-3">
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
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms
                      </a>
                      ,{' '}
                      <a
                        href="https://polar.sh/legal/privacy"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Privacy Policy
                      </a>{' '}
                      &amp;{' '}
                      <a
                        href="https://polar.sh/docs/merchant-of-record/account-reviews"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        AUP
                      </a>
                    </label>
                  </div>
                </div>
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
