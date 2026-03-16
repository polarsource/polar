'use client'

import { useAuth } from '@/hooks'
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
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useOnboardingData } from './OnboardingContext'
import { OnboardingShell } from './OnboardingShell'

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
  firstName: string
  lastName: string
  country: string
  dobYear: string
  dobMonth: string
  dobDay: string
}

export function PersonalDetailsStep() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { data, updateData, showApiResponse } = useOnboardingData()
  const updateUser = useUpdateUser()

  const dateOfBirthSource =
    data.dateOfBirth || currentUser?.date_of_birth || ''
  const parsedDob = dateOfBirthSource ? dateOfBirthSource.split('-') : []

  const form = useForm<FormSchema>({
    defaultValues: {
      firstName: data.firstName || currentUser?.first_name || '',
      lastName: data.lastName || currentUser?.last_name || '',
      country: data.country || currentUser?.country || '',
      dobYear: parsedDob[0] || '',
      dobMonth: parsedDob[1] || '',
      dobDay: parsedDob[2] || '',
    },
  })

  const { control, handleSubmit, watch } = form

  const firstName = watch('firstName')
  const lastName = watch('lastName')
  const country = watch('country')
  const dobYear = watch('dobYear')
  const dobMonth = watch('dobMonth')
  const dobDay = watch('dobDay')
  useEffect(() => {
    const dateOfBirth =
      dobYear && dobMonth && dobDay
        ? `${dobYear}-${dobMonth}-${dobDay}`
        : undefined
    updateData({ firstName, lastName, country, dateOfBirth })
  }, [firstName, lastName, country, dobYear, dobMonth, dobDay, updateData])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) =>
    String(currentYear - 18 - i),
  )
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: MONTH_NAMES[i],
  }))
  const days = Array.from({ length: 31 }, (_, i) =>
    String(i + 1).padStart(2, '0'),
  )

  const onSubmit = async (formData: FormSchema) => {
    const dateOfBirth = `${formData.dobYear}-${formData.dobMonth}-${formData.dobDay}`
    updateData({
      firstName: formData.firstName,
      lastName: formData.lastName,
      country: formData.country,
      dateOfBirth,
    })

    const { error } = await updateUser.mutateAsync({
      first_name: formData.firstName,
      last_name: formData.lastName,
      country: formData.country as schemas['CountryAlpha2Input'],
      date_of_birth: dateOfBirth,
    })

    if (error) {
      await showApiResponse(400, 'Failed to save personal details')
      return
    }

    await showApiResponse(201, 'Created')
    router.push('/onboarding/business')
  }

  return (
    <OnboardingShell
      title="Let's get to know you"
      subtitle={`Signed in as ${currentUser?.email ?? ''}. Tell us a bit about yourself to get started.`}
      step="personal"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="m"
          >
            <FormField
              control={control}
              name="firstName"
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
              name="lastName"
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

          <Box display="flex" flexDirection="column" rowGap="s">
            <FormLabel>Date of Birth</FormLabel>
            <Box display="flex" gap="m">
              <FormField
                control={control}
                name="dobMonth"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="dobDay"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="dobYear"
                rules={{ required: 'Required' }}
                render={({ field }) => (
                  <FormItem className="flex-1">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Box>
          </Box>

          <Button type="submit" fullWidth>
            Continue
          </Button>
        </form>
      </Form>
    </OnboardingShell>
  )
}
