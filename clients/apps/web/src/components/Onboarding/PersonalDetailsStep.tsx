'use client'

import { useAuth } from '@/hooks'
import * as Sentry from '@sentry/nextjs'
import { useUpdateUser } from '@/hooks/queries'
import { enums, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useOnboardingV2Tracking } from '@/hooks/onboardingV2'
import { useMonthDigitTypeahead } from '@/hooks/useMonthDigitTypeahead'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { setValidationErrors } from '@/utils/api/errors'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'
import { TermsCheckbox } from './TermsCheckbox'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

interface FormSchema {
  first_name: string
  last_name: string
  country: string
  dobYear: string
  dobMonth: string
  dobDay: string
  accepted_terms_of_service: boolean
}

function FormSync() {
  const { updateData } = useOnboardingData()
  const values = useWatch<FormSchema>()

  useEffect(() => {
    const dateOfBirth =
      values.dobYear && values.dobMonth && values.dobDay
        ? `${values.dobYear}-${values.dobMonth}-${String(values.dobDay).padStart(2, '0')}`
        : undefined
    updateData({
      firstName: values.first_name,
      lastName: values.last_name,
      country: values.country,
      dateOfBirth,
    })
  }, [values, updateData])

  return null
}

function SubmitButton({ loading }: { loading: boolean }) {
  const {
    first_name,
    last_name,
    country,
    dobYear,
    dobMonth,
    dobDay,
    accepted_terms_of_service,
  } = useWatch<FormSchema>()

  const disabled =
    !first_name ||
    !last_name ||
    !country ||
    !dobYear ||
    !dobMonth ||
    !dobDay ||
    !accepted_terms_of_service

  return (
    <Button type="submit" loading={loading} disabled={disabled} fullWidth>
      Continue
    </Button>
  )
}

export function PersonalDetailsStep({ geoCountry }: { geoCountry?: string }) {
  const router = useRouter()
  const { currentUser, reloadUser } = useAuth()
  const { data, updateData, setApiLoading, showApiResponse } =
    useOnboardingData()
  const { trackStepViewed, trackStepCompleted } = useOnboardingV2Tracking()
  const showTerms = useRef(!currentUser?.accepted_terms_of_service)
  const updateUser = useUpdateUser()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const safeGeoCountry =
    geoCountry &&
    (enums.addressInputCountryValues as string[]).includes(geoCountry)
      ? geoCountry
      : undefined

  trackStepViewed('personal')

  const dateOfBirthSource = data.dateOfBirth || currentUser?.date_of_birth || ''
  const parsedDob = dateOfBirthSource ? dateOfBirthSource.split('-') : []

  const form = useForm<FormSchema>({
    defaultValues: {
      first_name: data.firstName || currentUser?.first_name || '',
      last_name: data.lastName || currentUser?.last_name || '',
      country: data.country || currentUser?.country || safeGeoCountry || '',
      dobYear: parsedDob[0] || '',
      dobMonth: parsedDob[1] || '',
      dobDay: parsedDob[2] ? String(Number(parsedDob[2])) : '',
      accepted_terms_of_service:
        currentUser?.accepted_terms_of_service ?? false,
    },
  })

  const { control, handleSubmit, watch, setValue, setError } = form

  const handleMonthDigit = useMonthDigitTypeahead()

  // eslint-disable-next-line react-hooks/incompatible-library
  const country = watch('country')
  const isUnsupportedCountry =
    country !== '' &&
    !(enums.stripeAccountCountryValues as readonly string[]).includes(country)
  const countryDisplayName = useMemo(() => {
    if (!country) return ''
    return new Intl.DisplayNames([], { type: 'region' }).of(country) ?? country
  }, [country])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) =>
    String(currentYear - 18 - i),
  )
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: MONTH_NAMES[i],
  }))
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1))

  const onSubmit = async (formData: FormSchema) => {
    setSubmitting(true)
    setSubmitError(false)
    setApiLoading(true)
    const dateOfBirth = `${formData.dobYear}-${formData.dobMonth}-${formData.dobDay.padStart(2, '0')}`
    updateData({
      firstName: formData.first_name,
      lastName: formData.last_name,
      country: formData.country,
      dateOfBirth,
    })

    try {
      const { error } = await updateUser.mutateAsync({
        first_name: formData.first_name,
        last_name: formData.last_name,
        country: formData.country as schemas['CountryAlpha2Input'],
        date_of_birth: dateOfBirth,
        ...(formData.accepted_terms_of_service
          ? { accepted_terms_of_service: true }
          : {}),
      })

      if (error) {
        Sentry.captureException(error)
        setSubmitting(false)
        if (Array.isArray(error.detail)) {
          const remapped = error.detail.map((d) =>
            d.loc[1] === 'date_of_birth'
              ? { ...d, loc: [d.loc[0], 'dobMonth'] }
              : d,
          )
          setValidationErrors(remapped, setError)
        } else {
          setSubmitError(true)
        }
        await showApiResponse(400, 'Failed to save personal details')
        return
      }
    } catch (error) {
      Sentry.captureException(error)
      setSubmitting(false)
      setSubmitError(true)
      return
    }

    trackStepCompleted('personal')
    await showApiResponse(201, 'Created')
    reloadUser()
    router.push('/onboarding/business')
  }

  return (
    <OnboardingShell
      title="Let's get to know you"
      subtitle={`Signed in as ${currentUser?.email ?? ''}. Tell us a bit about yourself to get started.`}
      step="personal"
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
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="m"
          >
            <FormField
              control={control}
              name="first_name"
              rules={{ required: 'First name is required' }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Jane" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="last_name"
              rules={{ required: 'Last name is required' }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Doe" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Box>

          <Box display="flex" flexDirection="column" rowGap="s">
            <FormField
              control={control}
              name="country"
              rules={{ required: 'Country is required' }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Country</FormLabel>
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

            {isUnsupportedCountry && (
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
                  Payouts are not available in {countryDisplayName}&nbsp;yet.
                  You can still continue and we&rsquo;ll notify you when support
                  is added.
                </p>
              </Box>
            )}
          </Box>

          <Box display="flex" flexDirection="column" rowGap="s">
            <FormLabel>Date of Birth</FormLabel>
            <Box display="flex" gap="m">
              <FormField
                control={control}
                name="dobMonth"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          onKeyDown={(e) => handleMonthDigit(e, field.onChange)}
                        >
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="dobDay"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {days.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="dobYear"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
            </Box>
          </Box>

          {showTerms.current && (
            <TermsCheckbox
              control={control}
              name="accepted_terms_of_service"
              setValue={setValue}
            />
          )}

          <Box display="flex" flexDirection="column" rowGap="s">
            <SubmitButton loading={submitting} />
            {submitError && (
              <p className="text-sm text-red-500 dark:text-red-500">
                Something went wrong, please try again.
              </p>
            )}
          </Box>
        </Box>
      </Form>
    </OnboardingShell>
  )
}
