'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  FieldEvents,
  FieldFormat,
  FieldName,
  FieldUrl,
} from '@/components/Settings/Webhook/WebhookForm'
import { toast } from '@/components/Toast/use-toast'
import { useEditWebhookEndpoint } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

export default function WebhookContextView({
  endpoint,
}: {
  endpoint: schemas['WebhookEndpoint']
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secret, ...endpointWithoutSecret } = endpoint
  const form = useForm<schemas['WebhookEndpointUpdate']>({
    defaultValues: endpointWithoutSecret,
  })

  const { handleSubmit } = form
  const updateWebhookEndpoint = useEditWebhookEndpoint()

  const onSubmit = useCallback(
    async (body: schemas['WebhookEndpointUpdate']) => {
      const { error } = await updateWebhookEndpoint.mutateAsync({
        id: endpoint.id,
        body,
      })
      if (error) {
        toast({
          title: 'Webhook Endpoint Update Failed',
          description: `Error updating Webhook Endpoint: ${extractApiErrorMessage(error)}`,
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
            <FieldName />
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
