'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { api } from '@/utils/api'

import { WebhookEndpoint, WebhookEndpointUpdate } from '@polar-sh/sdk'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { FieldEvents, FieldSecret, FieldUrl } from '../../../Form'

export default function ClientPage({
  endpoint,
}: {
  endpoint: WebhookEndpoint
}) {
  const form = useForm<WebhookEndpointUpdate>({
    defaultValues: {
      // organization_id: organization.id,
      ...endpoint,
    },
  })

  const { handleSubmit } = form

  const [isSaving, setIsSaving] = useState(false)

  const onSubmit = useCallback(async (form: WebhookEndpointUpdate) => {
    setIsSaving(true)
    await api.webhooks.updateWebhookEndpoint({
      id: endpoint.id,
      webhookEndpointUpdate: form,
    })
    setIsSaving(false)
    window.location.reload()
  }, [])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Edit webhook</h2>
        </div>

        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
            <FieldUrl />
            <FieldSecret isUpdate={true} />
            <FieldEvents />

            <Button type="submit" loading={isSaving}>
              Save
            </Button>
          </form>
        </Form>
      </div>
    </DashboardBody>
  )
}
