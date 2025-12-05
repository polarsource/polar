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
import { Label } from '@polar-sh/ui/components/ui/label'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { FadeUp } from '../Animated/FadeUp'
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

    await revalidate(`users:${currentUser?.id}:organizations`, {
      expire: 0,
    })
    setUserOrganizations((orgs) => [...orgs, organization])

    let queryParams = ''
    if (hasExistingOrg) {
      queryParams = '?existing_org=true'
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
    <div className="dark:md:bg-polar-950 flex flex-col pt-16 md:items-center md:p-16">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ duration: 1, staggerChildren: 0.3 }}
        className="flex min-h-0 w-full shrink-0 flex-col gap-12 md:max-w-xl md:p-8"
      >
        <FadeUp className="flex flex-col items-center gap-y-8">
          <LogoIcon size={50} />
          <div className="flex flex-col items-center gap-y-4">
            <h1 className="text-3xl">
              {hasExistingOrg
                ? 'Create a new organization'
                : "Let's get you started"}
            </h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              {hasExistingOrg ? (
                'Follow the instructions below to create a new organization'
              ) : (
                <>You&rsquo;ll be up and running in no time</>
              )}
            </p>
          </div>
        </FadeUp>

        <div className="flex flex-col gap-12">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-y-8"
            >
              <div className="flex flex-col gap-y-8">
                <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
                  <FormField
                    control={control}
                    name="name"
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl className="flex w-full flex-col gap-y-4">
                          <Label htmlFor="name">Organization Name</Label>
                          <Input {...field} placeholder="Acme Inc." />
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
                      <FormItem className="w-full">
                        <FormControl className="flex w-full flex-col gap-y-4">
                          <Label htmlFor="slug">Organization Slug</Label>
                          <Input
                            type="text"
                            {...field}
                            size={slug?.length || 1}
                            placeholder="acme-inc"
                            onFocus={() => setEditedSlug(true)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FadeUp>

                <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
                  {/* Simple Product Restrictions */}
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
                        <li>• Physical goods or products requiring shipping</li>
                        <li>
                          • Human services (custom development, design and
                          consultancy)
                        </li>
                        <li>• Marketplaces</li>
                        <li>
                          • Anything in our list of{' '}
                          <a
                            href="https://polar.sh/docs/merchant-of-record/acceptable-use"
                            className="text-blue-500 underline dark:text-blue-400"
                            target="_blank"
                            rel="noreferrer"
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
                </FadeUp>

                <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
                  <FormField
                    control={control}
                    name="terms"
                    rules={{
                      required: 'You must accept the terms to continue',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-row items-start gap-x-3">
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
                                className="cursor-pointer leading-relaxed font-medium"
                              >
                                I understand the restrictions above and agree to
                                Polar&apos;s terms
                              </label>
                              <ul className="dark:text-polar-500 flex flex-col gap-y-1 text-sm text-gray-500">
                                <li>
                                  <a
                                    href="https://polar.sh/docs/merchant-of-record/account-reviews"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
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
                                    rel="noreferrer"
                                  >
                                    Terms of Service
                                  </a>
                                </li>
                                <li>
                                  <a
                                    href="https://polar.sh/legal/privacy"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
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
                </FadeUp>
              </div>
              {errors.root && (
                <p className="text-destructive-foreground text-sm">
                  {errors.root.message}
                </p>
              )}
              <FadeUp className="flex flex-col gap-y-3">
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
              </FadeUp>
            </form>
          </Form>
        </div>
      </motion.div>
    </div>
  )
}
