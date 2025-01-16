'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'

import {
  Organization,
  ResponseError,
  WebhookEndpoint,
  WebhookEndpointUpdate,
} from '@polar-sh/api'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

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
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
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

      try {
        await updateWebhookEndpoint.mutateAsync({
          id: endpoint.id,
          body: form,
        })

        toast({
          title: 'Webhook Endpoint Updated',
          description: `Webhook Endpoint was updated successfully`,
        })

        hide()
      } catch (e) {
        if (e instanceof ResponseError) {
          toast({
            title: 'Webhook Endpoint Update Failed',
            description: `Error updating Webhook Endpoint: ${e.message}`,
          })
        }
      } finally {
        setIsSaving(false)
      }
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
    try {
      await deleteWebhookEndpoint.mutateAsync({ id: endpoint.id })
      hideDeleteModal()
      hide()
      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}/settings`,
          'Webhook Endpoint Deleted',
          'Webhook Endpoint was deleted successfully',
        ),
      )
    } catch (e) {
      if (e instanceof ResponseError) {
        toast({
          title: 'Webhook Endpoint Deletion Failed',
          description: `Error deleting Webhook Endpoint: ${e.message}`,
        })
      }
    }
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

            <Button type="submit" loading={isSaving}>
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
