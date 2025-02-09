'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import {
  FieldEvents,
  FieldFormat,
  FieldSecret,
  FieldUrl,
} from '@/components/Settings/Webhook/WebhookForm'
import { toast } from '@/components/Toast/use-toast'
import { getStatusRedirect } from '@/components/Toast/utils'
import {
  useDeleteWebhookEndpoint,
  useEditWebhookEndpoint,
} from '@/hooks/queries'
import { components } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

export default function EditWebhookModal({
  organization,
  endpoint,
  hide,
}: {
  organization: components['schemas']['Organization']
  endpoint: components['schemas']['WebhookEndpoint']
  hide: () => void
}) {
  const form = useForm<components['schemas']['WebhookEndpointUpdate']>({
    defaultValues: {
      ...endpoint,
    },
  })

  const { handleSubmit } = form
  const updateWebhookEndpoint = useEditWebhookEndpoint()

  const onSubmit = useCallback(
    async (form: components['schemas']['WebhookEndpointUpdate']) => {
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
    const { error } = await await deleteWebhookEndpoint.mutateAsync({
      id: endpoint.id,
    })
    if (error) {
      toast({
        title: 'Webhook Endpoint Deletion Failed',
        description: `Error deleting Webhook Endpoint: ${error.detail}`,
      })
      return
    }

    hideDeleteModal()
    hide()
    router.push(
      getStatusRedirect(
        `/dashboard/${organization.slug}/settings/webhooks`,
        'Webhook Endpoint Deleted',
        'Webhook Endpoint was deleted successfully',
      ),
    )
  }, [
    deleteWebhookEndpoint,
    hideDeleteModal,
    router,
    endpoint,
    organization,
    hide,
  ])

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
            <FieldFormat />
            <FieldSecret isUpdate={true} />
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

        <ShadowBox className="flex flex-col gap-y-6 bg-gray-100 p-6">
          <div className="flex flex-col gap-y-1">
            <h3 className="font-medium text-gray-950 dark:text-white">
              Delete
            </h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              This action will delete the endpoint configuration and stop
              sending webhooks to it
            </p>
          </div>
          <Button
            className="self-start"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              showArchiveModal()
            }}
          >
            Delete
          </Button>
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
        </ShadowBox>
      </div>
    </DashboardBody>
  )
}
