'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useCreateWebhookEndpoint } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Banner from '@polar-sh/ui/components/molecules/Banner'
import { Form } from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FieldEvents, FieldFormat, FieldUrl } from './WebhookForm'

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

  const [created, setCreated] = useState<schemas['WebhookEndpoint']>()

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
    [hide, createWebhookEndpoint, setCreated],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">New webhook</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        {created ? (
          <Banner color={'green'}>
            <div className="flex w-full flex-row items-center justify-between">
              <span>Your hook was setup, and is now receiving events!</span>
              <Link
                href={`/dashboard/${organization.slug}/settings/webhooks/endpoints/${created.id}`}
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
    </div>
  )
}
