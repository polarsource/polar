'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useCreateWebhookEndpoint } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { FieldEvents, FieldFormat, FieldName, FieldUrl } from './WebhookForm'

export default function NewWebhookModal({
  organization,
  hide,
}: {
  organization: schemas['Organization']
  hide: () => void
}) {
  const router = useRouter()
  const form = useForm<schemas['WebhookEndpointCreate']>({
    defaultValues: {
      organization_id: organization.id,
    },
  })

  const { handleSubmit } = form

  const createWebhookEndpoint = useCreateWebhookEndpoint()

  const onSubmit = useCallback(
    async (form: schemas['WebhookEndpointCreate']) => {
      const { data, error } = await createWebhookEndpoint.mutateAsync(form)
      if (error) {
        toast({
          title: 'Webhook Endpoint Creation Failed',
          description: `Error creating Webhook Endpoint: ${error.detail}`,
        })
        return
      }
      toast({
        title: 'Webhook Endpoint Created',
        description: `Webhook Endpoint was created successfully`,
      })
      router.push(
        `/dashboard/${organization.slug}/settings/webhooks/endpoints/${data.id}`,
      )
    },
    [organization.slug, router, createWebhookEndpoint],
  )

  return (
    <>
      <InlineModalHeader hide={hide}>
        <div className="flex items-center justify-between gap-2">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <h2 className="text-xl">New webhook</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
            <FieldName />
            <FieldUrl />
            <FieldFormat />
            <FieldEvents />

            <Button
              type="submit"
              loading={createWebhookEndpoint.isPending}
              disabled={createWebhookEndpoint.isPending}
            >
              Create
            </Button>
          </form>
        </Form>
      </div>
    </>
  )
}
