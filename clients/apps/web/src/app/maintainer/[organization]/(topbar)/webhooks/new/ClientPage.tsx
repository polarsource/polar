'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { api } from '@/utils/api'

import {
  Organization,
  WebhookEndpoint,
  WebhookEndpointCreate,
} from '@polar-sh/sdk'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const form = useForm<WebhookEndpointCreate>({
    defaultValues: {
      organization_id: organization.id,
    },
  })

  const { handleSubmit } = form

  const [created, setCreated] = useState<WebhookEndpoint>()
  const [isCreating, setIsCreating] = useState(false)

  const onSubmit = useCallback(async (form: WebhookEndpointCreate) => {
    setIsCreating(true)
    const res = await api.webhooks.createWebhookEndpoint({
      webhookEndpointCreate: form,
    })
    setCreated(res)
    setIsCreating(false)
  }, [])

  const generateSecret = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const id = window.crypto.randomUUID()
    form.setValue('secret', id.replaceAll('-', ''))
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">New webhook</h2>
        </div>

        {created ? (
          <Banner color={'green'}>
            <div className="flex w-full flex-row items-center justify-between">
              <span>Your hook was setup, and is now receiving events!</span>
              <Link
                href={`/maintainer/${organization.name}/webhooks/endpoints/${created.id}`}
                className="shrink-0"
              >
                <Button asChild>Go to</Button>
              </Link>
            </div>
          </Banner>
        ) : null}

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="url"
              rules={{
                required: 'This field is required',
                validate: (value) => {
                  if (!value.startsWith('https://')) {
                    return false
                  }
                  return true
                },
              }}
              render={({ field }) => (
                <FormItem className="max-w-[300px]">
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>URL</FormLabel>
                  </div>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="secret"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => {
                return (
                  <FormItem className="max-w-[300px]">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Secret</FormLabel>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <Button onClick={generateSecret} disabled={isCreating}>
                      Generate
                    </Button>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <Button
              type="submit"
              loading={isCreating}
              disabled={Boolean(created)}
            >
              Create
            </Button>
          </form>
        </Form>
      </div>
    </DashboardBody>
  )
}
