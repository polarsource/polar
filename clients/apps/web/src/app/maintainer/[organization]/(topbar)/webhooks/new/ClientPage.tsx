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
import { Form } from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import { FieldEvents, FieldSecret, FieldUrl } from '../Form'

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
            <FieldUrl />
            <FieldSecret isUpdate={false} />
            <FieldEvents />

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
