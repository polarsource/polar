'use client'

import { useAuth } from '@/hooks'
import { useUpdateUser } from '@/hooks/queries'
import { useMonthDigitTypeahead } from '@/hooks/useMonthDigitTypeahead'
import { enums, schemas } from '@polar-sh/client'
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
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

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

function parseDateOfBirth(dob: string | null | undefined) {
  if (!dob) return { year: '', month: '', day: '' }
  const parts = dob.split('-')
  return { year: parts[0] || '', month: parts[1] || '', day: parts[2] || '' }
}

function buildDateOfBirth(year: string, month: string, day: string) {
  if (year && month && day) {
    return `${year}-${month}-${day}`
  }
  return undefined
}

const PersonalInformationSettings = () => {
  const { currentUser, reloadUser } = useAuth()
  const updateUser = useUpdateUser()

  const parsedDob = parseDateOfBirth(currentUser?.date_of_birth)

  const form = useForm<FormSchema>({
    defaultValues: {
      firstName: currentUser?.first_name || '',
      lastName: currentUser?.last_name || '',
      country: currentUser?.country || '',
      dobYear: parsedDob.year,
      dobMonth: parsedDob.month,
      dobDay: parsedDob.day,
    },
  })

  const { control, handleSubmit, reset } = form

  const handleMonthDigit = useMonthDigitTypeahead()

  useEffect(() => {
    if (currentUser) {
      const dob = parseDateOfBirth(currentUser.date_of_birth)
      reset({
        firstName: currentUser.first_name || '',
        lastName: currentUser.last_name || '',
        country: currentUser.country || '',
        dobYear: dob.year,
        dobMonth: dob.month,
        dobDay: dob.day,
      })
    }
  }, [currentUser, reset])

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

  const onSubmit = useCallback(
    async (formData: FormSchema) => {
      const body: schemas['UserUpdate'] = {
        first_name: formData.firstName || undefined,
        last_name: formData.lastName || undefined,
        country: (formData.country || undefined) as
          | schemas['CountryAlpha2Input']
          | undefined,
        date_of_birth: buildDateOfBirth(
          formData.dobYear,
          formData.dobMonth,
          formData.dobDay,
        ),
      }

      const { error } = await updateUser.mutateAsync(body)

      if (error) {
        toast({
          title: 'Update Failed',
          description: 'An error occurred while updating your information.',
        })
        return
      }

      await reloadUser()

      toast({
        title: 'Updated',
        description: 'Your personal information has been saved.',
      })
    },
    [updateUser, reloadUser],
  )

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="dark:ring-polar-700 flex w-full flex-col gap-y-6 overflow-hidden rounded-2xl bg-transparent p-5 ring-1 ring-gray-200 dark:ring-1"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Doe" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country of Residence</FormLabel>
              <FormControl>
                <CountryPicker
                  allowedCountries={enums.addressInputCountryValues}
                  value={field.value || undefined}
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
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={control}
              name="dobMonth"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="dobDay"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
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
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={updateUser.isPending}>
            {updateUser.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default PersonalInformationSettings
