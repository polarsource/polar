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
import LogoIcon from '../Brand/LogoIcon'
import { getStatusRedirect } from '../Toast/utils'

export interface OrganizationStepProps {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
  hasExistingOrg: boolean
}

export const OrganizationStep = ({
  slug: initialSlug,
  validationErrors,
  error,
  hasExistingOrg,
}: OrganizationStepProps) => {
  const posthog = usePostHog()
  const { currentUser, setUserOrganizations } = useAuth()

  const form = useForm<{
    name: string
    slug: string
    terms: boolean
  }>({
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

    let queryParams = ''
    if (hasExistingOrg) {
      queryParams = '?existing_org=1'
    }
    router.push(
      getStatusRedirect(
        `/dashboard/${organization.slug}/onboarding/product${queryParams}`,
        'Organization created',
        'You can now create your first product',
      ),
    )
  }

  return (
    <div className="flex h-full flex-col md:items-center md:p-12">
      <div className="md:dark:bg-polar-950 rounded-4xl dark:border-polar-700 flex min-h-0 w-full flex-shrink-0 flex-col gap-8 overflow-y-auto border-gray-200 p-4 md:max-w-xl md:border md:bg-white md:p-8 md:shadow-sm">
        <div className="flex flex-col gap-y-8">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Let&apos;s get you onboarded</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Get up to speed with an Organization, Product & Checkout Session.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-12">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-y-8"
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

                <div className="flex flex-col gap-y-4">
                  {/* Simple Product Restrictions */}
                  <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-y-3 rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-y-4 text-sm">
                      <div className="flex flex-col gap-y-2">
                        <p className="font-medium">Supported Usecases</p>
                        <p className="dark:text-polar-500 text-sm text-gray-500">
                          SaaS subscriptions, digital downloads, software
                          licenses, online courses, and other purely digital
                          products.
                        </p>
                      </div>

                      <div className="flex flex-col gap-y-2">
                        <p className="font-medium">Prohibited Usecases</p>
                        <ul className="dark:text-polar-500 space-y-1 text-sm text-gray-500">
                          <li>
                            • Physical goods or products requiring shipping
                          </li>
                          <li>
                            • Human services (custom development, design and
                            consultancy)
                          </li>
                          <li>• Marketplaces</li>
                          <li>
                            • Anything in our list of{' '}
                            <a
                              href="https://docs.polar.sh/merchant-of-record/acceptable-use"
                              className="text-blue-500 underline dark:text-blue-400"
                              target="_blank"
                            >
                              prohibited products
                            </a>
                          </li>
                        </ul>
                      </div>

                      <div className="dark:border-polar-700 border-t border-gray-200 pt-4">
                        <p className="dark:text-polar-500 text-xs text-gray-500">
                          Transactions that violate our policy will be canceled
                          and refunded.
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={control}
                    name="terms"
                    rules={{
                      required: 'You must accept the terms to continue',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="dark:border-polar-700 dark:bg-polar-900 flex flex-row items-start gap-x-3 rounded-lg border border-gray-200 bg-white p-4">
                            <Checkbox
                              id="terms"
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                const value = checked ? true : false
                                setValue('terms', value)
                              }}
                              className="mt-1"
                            />
                            <div className="flex flex-col gap-y-2 text-sm">
                              <label
                                htmlFor="terms"
                                className="cursor-pointer font-medium leading-relaxed"
                              >
                                I understand the restrictions above and agree to
                                Polar&apos;s terms
                              </label>
                              <ul className="dark:text-polar-500 flex flex-col gap-y-1 text-sm text-gray-500">
                                <li>
                                  <a
                                    href="https://docs.polar.sh/merchant-of-record/account-reviews"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                  >
                                    Account Reviews Policy
                                  </a>
                                  {' - '}I&apos;ll comply with KYC/AML
                                  requirements including website and social
                                  verification
                                </li>
                                <li>
                                  <a
                                    href="https://polar.sh/legal/terms"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                  >
                                    Terms of Service
                                  </a>
                                </li>
                                <li>
                                  <a
                                    href="https://polar.sh/legal/privacy"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                  >
                                    Privacy Policy
                                  </a>
                                </li>
                              </ul>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
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
                {hasExistingOrg && (
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
    </div>
  )
}
