'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'

import {
  Organization,
  WebhookEndpoint,
  WebhookEndpointUpdate,
} from '@polar-sh/sdk'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import {
  FieldEvents,
  FieldSecret,
  FieldUrl,
} from '@/components/Settings/Webhook/WebhookForm'
import {
  useDeleteWebhookEndpoint,
  useEditWebhookEndpoint,
} from '@/hooks/queries'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'

export default function EditWebhookModal({
  organization,
  endpoint,
  hide,
}: {
  organization: Organization
  endpoint: WebhookEndpoint
  hide: () => void
}) {
  const form = useForm<WebhookEndpointUpdate>({
    defaultValues: {
      // organization_id: organization.id,
      ...endpoint,
    },
  })

  const { handleSubmit } = form

  const [isSaving, setIsSaving] = useState(false)

  const updateWebhookEndpoint = useEditWebhookEndpoint()

  const onSubmit = useCallback(
    async (form: WebhookEndpointUpdate) => {
      setIsSaving(true)
      await updateWebhookEndpoint.mutateAsync({
        id: endpoint.id,
        webhookEndpointUpdate: form,
      })
      setIsSaving(false)
      hide()
    },
    [endpoint],
  )

  const {
    hide: hideDeleteModal,
    isShown: isArchiveModalShown,
    show: showArchiveModal,
  } = useModal()

  const router = useRouter()

  const deleteWebhookEndpoint = useDeleteWebhookEndpoint()

  const handleDeleteWebhookEndpoint = useCallback(async () => {
    await deleteWebhookEndpoint.mutateAsync({ id: endpoint.id })
    hideDeleteModal()
    hide()
    router.push(`/maintainer/${organization.name}/settings`)
  }, [hideDeleteModal, router, endpoint, organization, hide])

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

        <ShadowBoxOnMd className="flex flex-col gap-y-8 md:bg-gray-100">
          <div className="flex flex-row items-start justify-between">
            <div className="flex flex-col gap-y-1">
              <h3 className="font-medium text-gray-950 dark:text-white">
                Delete
              </h3>
              <p className="dark:text-white0 text-sm text-gray-500">
                This action will delete the endpoint configuration and stop
                sending webhooks to it
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                showArchiveModal()
              }}
            >
              Delete
            </Button>
          </div>
          <ConfirmModal
            title="Delete Webhook Endpoint"
            description={
              'This action will delete the endpoint configuration and stop sending webhooks to it'
            }
            destructiveText="Delete"
            onConfirm={handleDeleteWebhookEndpoint}
            isShown={isArchiveModalShown}
            hide={hideDeleteModal}
            destructive
          />
        </ShadowBoxOnMd>
      </div>
    </DashboardBody>
  )
}
