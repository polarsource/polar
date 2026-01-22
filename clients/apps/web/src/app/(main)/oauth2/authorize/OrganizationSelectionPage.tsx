'use client'

import revalidate from '@/app/actions'
import LogoType from '@/components/Brand/LogoType'
import SupportedUseCases from '@/components/Onboarding/components/SupportedUseCases'
import { useAuth } from '@/hooks'
import { useCreateOrganization } from '@/hooks/queries'
import { getServerURL } from '@/utils/api'
import { setValidationErrors } from '@/utils/api/errors'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { FormControl } from '@mui/material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'

const OrganizationSelectionPage = ({
  authorizeResponse: { client, organizations },
  searchParams,
}: {
  authorizeResponse: schemas['AuthorizeResponseOrganization']
  searchParams: Record<string, string>
}) => {
  const router = useRouter()
  const { currentUser, setUserOrganizations } = useAuth()
  const createOrganization = useCreateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)

  const form = useForm<{
    name: string
    slug: string
    terms: boolean
  }>({
    defaultValues: {
      name: '',
      slug: '',
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

  const serializedSearchParams = new URLSearchParams(searchParams).toString()
  const actionURL = `${getServerURL()}/v1/oauth2/consent?${serializedSearchParams}`

  const buildOrganizationSelectionURL = (
    organization: schemas['AuthorizeOrganization'],
  ) => {
    const updatedSearchParams = {
      ...searchParams,
      sub: organization.id,
    }
    const serializedSearchParams = new URLSearchParams(
      updatedSearchParams,
    ).toString()
    return `?${serializedSearchParams}`
  }

  const onSubmit = async (data: {
    name: string
    slug: string
    terms: boolean
  }) => {
    if (!data.terms) return

    const { data: organization, error } = await createOrganization.mutateAsync({
      name: data.name,
      slug: data.slug,
    })

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

    // Navigate to the same page with the new organization selected
    const updatedSearchParams = new URLSearchParams({
      ...searchParams,
      sub: organization.id,
    })
    router.push(`?${updatedSearchParams.toString()}`)
  }

  const clientName = client.client_name || client.client_id
  const hasTerms = client.policy_uri || client.tos_uri
  const hasOrganizations = organizations.length > 0

  // No organizations - show create form
  if (!hasOrganizations) {
    return (
      <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-white">
        <div className="flex w-96 flex-col items-center gap-6">
          <div className="flex flex-row items-center gap-2">
            <LogoType className="h-10" />
            {client.logo_uri && (
              <>
                <AddOutlined className="h-5" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={client.logo_uri} className="h-10" alt={clientName} />
              </>
            )}
          </div>
          <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
            Welcome to Polar!
            <br />
            Create an organization and connect to{' '}
            <span className="font-medium">{clientName}</span>.
          </div>

          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6 lg:-mx-16"
            >
              <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6">
                <FormField
                  control={control}
                  name="name"
                  rules={{
                    required: 'Organization name is required',
                    minLength: {
                      value: 3,
                      message: 'Name must be at least 3 characters',
                    },
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
                    minLength: {
                      value: 3,
                      message: 'Slug must be at least 3 characters',
                    },
                  }}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl className="flex w-full flex-col gap-y-4">
                        <Label htmlFor="slug">Organization Slug</Label>
                        <Input
                          type="text"
                          {...field}
                          placeholder="acme-inc"
                          onFocus={() => setEditedSlug(true)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6">
                <SupportedUseCases />
              </div>

              <div className="dark:bg-polar-800 dark:border-polar-700 gap-y- flex flex-col rounded-2xl border border-gray-200 bg-white p-6">
                <FormField
                  control={control}
                  name="terms"
                  rules={{
                    required: 'You must accept the terms to continue',
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-start gap-x-3">
                        <Checkbox
                          id="terms"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            setValue('terms', checked === true)
                          }}
                          className="mt-1"
                        />
                        <div className="flex flex-col gap-y-2 text-sm">
                          <label
                            htmlFor="terms"
                            className="cursor-pointer leading-relaxed font-medium"
                          >
                            I understand the restrictions above and agree to
                            Polar&rsquo;s terms
                          </label>
                          <ul className="dark:text-polar-400 flex flex-col gap-y-1 text-sm text-gray-500">
                            <li>
                              <a
                                href="https://polar.sh/docs/merchant-of-record/account-reviews"
                                className="text-blue-600 hover:underline dark:text-blue-400"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Account Reviews Policy
                              </a>
                              {' - '}I&apos;ll comply with KYC/AML requirements
                              including website and social verification
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
                  )}
                />
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
                  disabled={name.length < 3 || slug.length < 3 || !terms}
                >
                  Create Organization
                </Button>
                <form method="post" action={actionURL}>
                  <Button
                    variant="secondary"
                    className="w-full"
                    type="submit"
                    name="action"
                    value="deny"
                  >
                    Deny
                  </Button>
                </form>
              </div>
            </form>
          </Form>

          {hasTerms && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Before using this app, you can review {clientName}&apos;s{' '}
              {client.tos_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.tos_uri}
                >
                  Terms of Service
                </a>
              )}
              {client.tos_uri && client.policy_uri && ' and '}
              {client.policy_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.policy_uri}
                >
                  Privacy Policy
                </a>
              )}
              .
            </div>
          )}
        </div>
      </div>
    )
  }

  // Has organizations - show selection list
  return (
    <form method="post" action={actionURL}>
      <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-white">
        <div className="flex w-80 flex-col items-center gap-6">
          <div className="flex flex-row items-center gap-2">
            <LogoType className="h-10" />
            {client.logo_uri && (
              <>
                <AddOutlined className="h-5" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={client.logo_uri} className="h-10" alt={clientName} />
              </>
            )}
          </div>
          <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
            <span className="font-medium">{clientName}</span> wants to access
            one of your Polar organizations. Select one:
          </div>
          <div className="flex w-full flex-col gap-2">
            {organizations.map((organization) => (
              <Link
                key={organization.id}
                href={buildOrganizationSelectionURL(organization)}
              >
                <div className="dark:bg-polar-700 dark:hover:bg-polar-600 flex w-full flex-row items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-3 text-sm transition-colors hover:border-gray-300 dark:border-white/5 dark:hover:border-white/5">
                  <Avatar
                    className="h-8 w-8"
                    avatar_url={organization.avatar_url}
                    name={organization.slug}
                  />
                  {organization.slug}
                </div>
              </Link>
            ))}
          </div>
          <div className="grid w-full">
            <Button
              variant="secondary"
              className="grow"
              type="submit"
              name="action"
              value="deny"
            >
              Deny
            </Button>
          </div>
          {hasTerms && (
            <div className="mt-8 text-center text-sm text-gray-500">
              Before using this app, you can review {clientName}&apos;s{' '}
              {client.tos_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.tos_uri}
                >
                  Terms of Service
                </a>
              )}
              {client.tos_uri && client.policy_uri && ' and '}
              {client.policy_uri && (
                <a
                  className="dark:text-polar-300 text-gray-700"
                  href={client.policy_uri}
                >
                  Privacy Policy
                </a>
              )}
              .
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

export default OrganizationSelectionPage
