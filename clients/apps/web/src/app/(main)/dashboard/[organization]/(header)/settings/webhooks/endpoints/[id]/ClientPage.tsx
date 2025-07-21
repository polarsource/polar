'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import WebhookContextView from '@/components/Settings/Webhook/WebhookContextView'
import DeliveriesTable from '@/components/Settings/Webhook/WebhookDeliveriesTable'
import { toast } from '@/components/Toast/use-toast'
import { getStatusRedirect } from '@/components/Toast/utils'
import {
  useDeleteWebhookEndpoint,
  useResetSecretWebhookEndpoint,
  useWebhookEndpoint,
} from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'

export default function ClientPage({
  organization,
  pagination,
  sorting,
}: {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}) {
  const { id }: { id: string } = useParams()
  const router = useRouter()

  const { data: endpoint } = useWebhookEndpoint(id)

  const {
    hide: hideResetModal,
    isShown: isResetModalShown,
    show: showResetModal,
  } = useModal()
  const resetSecretWebhookEndpoint = useResetSecretWebhookEndpoint()
  const handleResetSecret = useCallback(async () => {
    if (!endpoint) return
    const { error } = await resetSecretWebhookEndpoint.mutateAsync({
      id: endpoint.id,
    })
    if (error) {
      toast({
        title: 'Webhook Secret Reset Failed',
        description: `Error resetting Webhook Secret: ${error.detail}`,
      })
      return
    }

    hideResetModal()
    toast({
      title: 'Webhook Secret Reset',
      description: 'Webhook Secret was reset successfully',
    })
  }, [resetSecretWebhookEndpoint, hideResetModal, endpoint])

  const {
    hide: hideDeleteModal,
    isShown: isArchiveModalShown,
    show: showArchiveModal,
  } = useModal()
  const deleteWebhookEndpoint = useDeleteWebhookEndpoint()
  const handleDeleteWebhookEndpoint = useCallback(async () => {
    if (!endpoint) return

    const { error } = await deleteWebhookEndpoint.mutateAsync({
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

    router.push(
      getStatusRedirect(
        `/dashboard/${organization.slug}/settings/webhooks`,
        'Webhook Endpoint Deleted',
        'Webhook Endpoint was deleted successfully',
      ),
    )
  }, [deleteWebhookEndpoint, hideDeleteModal, router, endpoint, organization])

  if (!endpoint) {
    return null
  }

  return (
    <DashboardBody
      title="Webhook"
      header={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={showResetModal}>
            Reset Secret
          </Button>
          <Button variant="destructive" onClick={showArchiveModal}>
            Delete
          </Button>
        </div>
      }
      contextView={<WebhookContextView endpoint={endpoint} />}
      className="gap-y-8"
      wide
    >
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">{endpoint.url}</h3>
        <CopyToClipboardInput
          value={endpoint.secret}
          buttonLabel="Copy Secret"
        />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-medium">Deliveries</h2>
        </div>
        <DeliveriesTable
          endpoint={endpoint}
          pagination={pagination}
          sorting={sorting}
          organization={organization}
        />
      </div>

      <ConfirmModal
        title="Reset Webhook Secret"
        description={
          'This action will reset the webhook secret and invalidate the previous one. Are you sure you want to continue?'
        }
        destructiveText="Reset Secret"
        onConfirm={handleResetSecret}
        isShown={isResetModalShown}
        hide={hideResetModal}
      />
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
    </DashboardBody>
  )
}
