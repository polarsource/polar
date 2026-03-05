'use client'

import { useAuth } from '@/hooks'
import { enums } from '@polar-sh/client'
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

interface FormSchema {
  fullName: string
  country: string
  dobYear: string
  dobMonth: string
  dobDay: string
}

export function PersonalDetailsStep() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { data, updateData, showApiResponse } = useOnboardingData()

  const parsedDob = data.dateOfBirth ? data.dateOfBirth.split('-') : []

  const form = useForm<FormSchema>({
    defaultValues: {
      fullName: data.fullName || '',
      country: data.country || '',
      dobYear: parsedDob[0] || '',
      dobMonth: parsedDob[1] || '',
      dobDay: parsedDob[2] || '',
    },
  })

  const { control, handleSubmit, watch } = form

  const fullName = watch('fullName')
  const country = watch('country')
  const dobYear = watch('dobYear')
  const dobMonth = watch('dobMonth')
  const dobDay = watch('dobDay')

  // Sync visual-relevant fields to context for the animated preview
  useEffect(() => {
    const dateOfBirth =
      dobYear && dobMonth && dobDay
        ? `${dobYear}-${dobMonth}-${dobDay}`
        : undefined
    updateData({ fullName, country, dateOfBirth })
  }, [fullName, country, dobYear, dobMonth, dobDay, updateData])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) =>
    String(currentYear - 18 - i),
  )
  const months = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, '0'),
  )
  const days = Array.from({ length: 31 }, (_, i) =>
    String(i + 1).padStart(2, '0'),
  )

  const onSubmit = async (formData: FormSchema) => {
    const dateOfBirth = `${formData.dobYear}-${formData.dobMonth}-${formData.dobDay}`
    updateData({
      fullName: formData.fullName,
      country: formData.country,
      dateOfBirth,
    })
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
          <FormField
            control={control}
            name="fullName"
            rules={{ required: 'Full name is required' }}
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Jane Doe" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <div className="flex flex-col gap-y-2">
            <FormLabel>Date of Birth</FormLabel>
            <div className="flex gap-3">
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
                            <SelectItem key={m} value={m}>
                              {m}
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
            </div>
          </div>

          <Button type="submit" fullWidth>
            Continue
          </Button>
        </form>
      </Form>
    </OnboardingShell>
  )
}
