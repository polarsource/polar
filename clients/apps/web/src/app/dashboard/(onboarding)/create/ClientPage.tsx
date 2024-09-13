'use client'

import revalidate from '@/app/actions'
import { useAuth } from '@/hooks'
import { useCreateOrganization, useListOrganizations } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { FormControl } from '@mui/material'
import { ResponseError, ValidationError } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'

export default function ClientPage({
  slug: initialSlug,
  validationErrors,
  error,
}: {
  slug?: string
  validationErrors?: ValidationError[]
  error?: string
}) {
  const { currentUser, setUserOrganizations } = useAuth()
  const router = useRouter()
  const form = useForm<{ name: string; slug: string }>({
    defaultValues: { name: initialSlug || '', slug: initialSlug || '' },
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

  const { data: existingOrganizations } = useListOrganizations(
    { slug, limit: 1 },
    !!slug,
  )

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

  useEffect(() => {
    if (
      existingOrganizations &&
      existingOrganizations.pagination.total_count > 0
    ) {
      setError('root', {
        type: 'manual',
        message: 'An organization with this slug already exists.',
      })
    } else {
      clearErrors('root')
    }
  }, [existingOrganizations, setError, clearErrors])

  const onSubmit = async (data: { name: string; slug: string }) => {
    try {
      const organization = await createOrganization.mutateAsync({
        ...data,
        slug: slug as string,
      })

      await revalidate(`organizations:${organization.id}`)
      await revalidate(`organizations:${organization.slug}`)
      await revalidate(`users:${currentUser?.id}:organizations`)
      setUserOrganizations((orgs) => [...orgs, organization])
      router.push(`/dashboard/${organization.slug}`)
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(validationErrors, setError)
        } else {
          setError('root', { message: e.message })
        }
      }
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-12 py-12">
      <div className="flex flex-col items-center gap-y-6">
        <h1 className="text-3xl font-semibold">Let&apos;s get started</h1>
        <p className="dark:text-polar-400 text-center text-lg text-gray-600">
          To start monetizing on Polar, you need to create an organization.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full flex-col gap-y-12"
        >
          <ShadowBox className="flex w-full flex-col gap-y-6">
            <FormField
              control={control}
              name="name"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl className="w-full">
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(slug || editedSlug) && (
              <p className="dark:text-polar-400 w-full text-sm text-gray-600">
                https://polar.sh/
                <FormField
                  control={control}
                  name="slug"
                  rules={{
                    required: 'This field is required',
                  }}
                  render={({ field }) => (
                    <>
                      <input
                        type="text"
                        {...field}
                        size={slug?.length || 1}
                        className="dark:bg-polar-700 ml-1 rounded-md border-0 bg-gray-100 px-2 py-1 text-sm text-black focus:outline-none focus:ring-0 dark:text-white"
                        onFocus={() => setEditedSlug(true)}
                      />
                      <FormMessage />
                    </>
                  )}
                />
              </p>
            )}
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
          </ShadowBox>

          <Button
            className="self-start"
            type="submit"
            size="lg"
            loading={createOrganization.isPending}
          >
            Create
          </Button>
        </form>
      </Form>
    </div>
  )
}
