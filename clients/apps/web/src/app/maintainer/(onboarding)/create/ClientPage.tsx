'use client'

import { useCreateOrganization, useListOrganizations } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { FormControl } from '@mui/material'
import { ResponseError, ValidationError } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Input } from 'polarkit/components/ui/input'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'

export default function ClientPage() {
  const router = useRouter()
  const form = useForm<{ name: string; slug: string }>()
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

  const name = watch('name')
  const slug = watch('slug')

  const { data: existingOrganizations } = useListOrganizations(
    { slug, limit: 1 },
    !!slug,
  )

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true }))
    } else if (slug) {
      setValue('slug', slugify(slug, { lower: true, trim: false }))
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
      router.push(`/maintainer/${organization.slug}`)
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
    <div className="flex max-w-4xl flex-col gap-12 py-12">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">Let&apos;s get started</h1>
        <p className="dark:text-polar-400 text-center text-gray-600">
          To start monetizing on Polar, you need to create an organization.
          It&apos;s a space to create and manage your products, receive
          donations from your supporters and more.
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col items-center justify-center gap-y-6"
        >
          <FormField
            control={control}
            name="name"
            rules={{
              required: 'This field is required',
            }}
            render={({ field }) => (
              <FormItem className="w-3/4">
                <FormControl className="w-full">
                  <Input
                    className="p-6 text-center text-2xl"
                    placeholder="Name of your organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {(slug || editedSlug) && (
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Your URL will be: https://polar.sh/
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
                      className="m-0 rounded-md border-0 bg-transparent p-0 text-blue-500 underline decoration-dotted hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
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
          <Button
            type="submit"
            className="w-3/4"
            size="lg"
            disabled={Object.keys(errors).length > 0}
            loading={createOrganization.isPending}
          >
            Create my organization
          </Button>
        </form>
      </Form>
    </div>
  )
}
