'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  FieldEvents,
  FieldFormat,
  FieldUrl,
} from '@/components/Settings/Webhook/WebhookForm'
import { toast } from '@/components/Toast/use-toast'
import { useEditWebhookEndpoint } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

export default function WebhookContextView({
  endpoint,
}: {
  endpoint: schemas['WebhookEndpoint']
}) {
  const form = useForm<schemas['WebhookEndpointUpdate']>({
    defaultValues: {
      ...endpoint,
    },
  })

  const { handleSubmit } = form
  const updateWebhookEndpoint = useEditWebhookEndpoint()

  const onSubmit = useCallback(
    async (form: schemas['WebhookEndpointUpdate']) => {
      const { error } = await updateWebhookEndpoint.mutateAsync({
        id: endpoint.id,
        body: form,
      })
      if (error) {
        toast({
          title: 'Webhook Endpoint Update Failed',
          description: `Error updating Webhook Endpoint: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Webhook Endpoint Updated',
        description: `Webhook Endpoint was updated successfully`,
      })
    },
    [endpoint, updateWebhookEndpoint],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex max-w-[700px] flex-col gap-y-4"
          >
            <FieldUrl />
            <FieldFormat />
            <FieldEvents />

            <Button
              type="submit"
              loading={updateWebhookEndpoint.isPending}
              disabled={updateWebhookEndpoint.isPending}
            >
              Save
            </Button>
          </form>
        </Form>
      </div>
    </DashboardBody>
  )
}
