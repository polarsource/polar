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
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import { events } from '../events'

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
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
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
                <FormItem className="flex flex-col gap-1">
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
                  <FormItem className="flex flex-col gap-1">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Secret</FormLabel>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <Button onClick={generateSecret} disabled={isCreating}>
                        Generate
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Polar will sign all webhook payloads with this secret
                      (following the{' '}
                      <a
                        href="https://www.standardwebhooks.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium"
                      >
                        Standard Webhooks
                      </a>{' '}
                      specification) so that you can validate that the request
                      is coming from us.
                    </div>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Events
              </h2>

              {events.map((e) => (
                <FormField
                  key={e[0]}
                  control={form.control}
                  name={e[0]}
                  render={({ field }) => {
                    return (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            defaultChecked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm leading-none">
                          {e[1]}
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              ))}
            </div>

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
