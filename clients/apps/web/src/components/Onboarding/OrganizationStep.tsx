'use client'

import revalidate from '@/app/actions'
import { useAuth } from '@/hooks'
import { usePostHog } from '@/hooks/posthog'
import { useCreateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { FormControl } from '@mui/material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'
import { Testamonial, testimonials } from '../Landing/Testimonials'
import { getStatusRedirect } from '../Toast/utils'

export interface OrganizationStepProps {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
}

export const OrganizationStep = ({
  slug: initialSlug,
  validationErrors,
  error,
}: OrganizationStepProps) => {
  const posthog = usePostHog()
  const { currentUser, setUserOrganizations, userOrganizations } = useAuth()

  const form = useForm<{ name: string; slug: string; terms: boolean }>({
    defaultValues: {
      name: initialSlug || '',
      slug: initialSlug || '',
      terms: false,
    },
  })

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = form
  const createOrganization = useCreateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)

  const router = useRouter()

  useEffect(() => {
    posthog.capture('dashboard:organizations:create:view')
  }, [])

  useEffect(() => {
    if (validationErrors) {
      setValidationErrors(validationErrors, setError)
    }
    if (error) {
      setError('root', { message: error })
    } else {
      clearErrors('root')
    }
  }, [validationErrors, error, setError, clearErrors])

  const name = watch('name')
  const slug = watch('slug')
  const terms = watch('terms')

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    } else if (slug) {
      setValue(
        'slug',
        slugify(slug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [name, editedSlug, slug, setValue])

  const onSubmit = async (data: {
    name: string
    slug: string
    terms: boolean
  }) => {
    if (!data.terms) return

    const params = {
      ...data,
      slug: slug as string,
    }
    posthog.capture('dashboard:organizations:create:submit', params)
    const { data: organization, error } =
      await createOrganization.mutateAsync(params)

    if (error) {
      if (error.detail) {
        setValidationErrors(error.detail, setError)
      }
      return
    }

    await revalidate(`users:${currentUser?.id}:organizations`)
    setUserOrganizations((orgs) => [...orgs, organization])

    router.push(
      getStatusRedirect(
        `/dashboard/${organization.slug}/onboarding/product`,
        'Organization created',
        'You can now create your first product',
      ),
    )
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex h-full min-h-0 w-full flex-shrink-0 flex-col gap-12 overflow-y-auto p-12 md:max-w-lg">
        <div className="flex flex-col gap-y-12">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Let&apos;s get you onboarded</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Get up to speed with an Organization, Product & Checkout Session.
            </p>
          </div>
        </div>
        <div className="flex flex-row gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={twMerge(
                'dark:bg-polar-700 flex h-2 flex-1 rounded-full bg-gray-300',
                index === 0 && 'bg-black dark:bg-white',
              )}
            />
          ))}
        </div>

        <div className="flex flex-col gap-12">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-y-12"
            >
              <div className="flex flex-col gap-y-4">
                <FormField
                  control={control}
                  name="name"
                  rules={{
                    required: 'This field is required',
                  }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl className="w-full">
                        <Input {...field} placeholder="Organization Name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="slug"
                  rules={{
                    required: 'Slug is required',
                  }}
                  render={({ field }) => (
                    <>
                      <Input
                        type="text"
                        {...field}
                        size={slug?.length || 1}
                        placeholder="Organization Slug"
                        onFocus={() => setEditedSlug(true)}
                      />
                      <FormMessage />
                    </>
                  )}
                />

                <div className="dark:text-polar-400 mt-2 text-gray-600">
                  <FormField
                    control={control}
                    name="terms"
                    rules={{
                      required: 'You have to accept the terms',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-row items-center gap-x-3">
                            <Checkbox
                              id="terms"
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                // String | boolean type for some reason
                                const value = checked ? true : false
                                setValue('terms', value)
                              }}
                            />
                            <label
                              htmlFor="terms"
                              className="text-sm font-medium"
                            >
                              I confirm and agree to the terms below
                            </label>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <hr className="my-4" />
                  <ul className="ml-1 list-inside list-disc space-y-2 text-xs">
                    <li>
                      <a
                        href="https://docs.polar.sh/merchant-of-record/acceptable-use"
                        className="text-blue-500 dark:text-blue-400"
                        target="_blank"
                      >
                        Acceptable Use Policy
                      </a>
                      . I&apos;ll only sell digital products and SaaS that
                      complies with it or risk suspension.
                    </li>
                    <li>
                      <a
                        href="https://docs.polar.sh/merchant-of-record/account-reviews"
                        className="text-blue-500 dark:text-blue-400"
                        target="_blank"
                      >
                        Account Reviews
                      </a>
                      . I&apos;ll comply with all reviews and requests for
                      compliance materials (KYC/AML).
                    </li>
                    <li>
                      <a
                        href="https://polar.sh/legal/terms"
                        className="text-blue-500 dark:text-blue-400"
                        target="_blank"
                      >
                        Terms of Service
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://polar.sh/legal/privacy"
                        className="text-blue-500 dark:text-blue-400"
                        target="_blank"
                      >
                        Privacy Policy
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              {errors.root && (
                <p className="text-destructive-foreground text-sm">
                  {errors.root.message}
                </p>
              )}
              <div className="flex flex-col gap-y-3">
                <Button
                  type="submit"
                  loading={createOrganization.isPending}
                  disabled={name.length === 0 || slug.length === 0 || !terms}
                >
                  Create
                </Button>
                {userOrganizations.length > 0 && (
                  <Link href={`/dashboard`} className="w-full">
                    <Button variant="secondary" fullWidth>
                      Back to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
      <div className="dark:bg-polar-950 relative hidden flex-1 flex-grow flex-col items-center justify-center gap-12 overflow-hidden bg-gray-100 p-12 md:flex">
        <div className="absolute inset-0 flex flex-col items-center">
          <TestimonialsWrapper />
        </div>
      </div>
    </div>
  )
}

const TestimonialsWrapper = () => {
  const thirdLength = Math.ceil(testimonials.length / 3)
  const firstRow = testimonials.slice(0, thirdLength)
  const secondRow = testimonials.slice(thirdLength, thirdLength * 2)
  const thirdRow = testimonials.slice(thirdLength * 2)

  return (
    <div className="flex flex-col items-center gap-y-12 px-4 md:gap-y-24">
      <div className="flex flex-col gap-4 md:relative md:w-full md:overflow-hidden">
        <div className="flex flex-row gap-4">
          {[firstRow, secondRow, thirdRow].map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className="min-w-1/3 flex w-full max-w-[400px] flex-col gap-4 md:h-max md:animate-[infinite-vertical-scroll_50s_linear_infinite_forwards]"
            >
              {[...row, ...row, ...row].map((testimonial, index) => (
                <div key={`row${rowIndex}-${index}`}>
                  <Testamonial {...testimonial} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
