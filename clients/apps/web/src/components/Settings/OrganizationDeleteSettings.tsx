'use client'

import { useDeleteOrganization } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

const TOAST_LONG_DURATION = 8000

interface OrganizationDeleteSettingsProps {
  organization: schemas['Organization']
}

export default function OrganizationDeleteSettings({
  organization,
}: OrganizationDeleteSettingsProps) {
  const router = useRouter()
  const deleteOrganization = useDeleteOrganization()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDelete = useCallback(async () => {
    const { data, error } = await deleteOrganization.mutateAsync({
      id: organization.id,
    })

    if (error) {
      toast({
        title: 'Deletion Failed',
        description: error.detail as string,
        variant: 'error',
        duration: TOAST_LONG_DURATION,
      })
      return
    }

    if (data.deleted) {
      toast({
        title: 'Organization Deleted',
        description: 'Your organization has been successfully deleted.',
        variant: 'success',
        duration: TOAST_LONG_DURATION,
      })
      router.push('/dashboard')
    } else if (data.requires_support) {
      const reasons = (data.blocked_reasons ?? [])
        .map((r: string) => {
          switch (r) {
            case 'has_orders':
              return 'has existing orders'
            case 'has_active_subscriptions':
              return 'has active subscriptions'
            case 'stripe_account_deletion_failed':
              return 'Stripe account could not be deleted'
            default:
              return r
          }
        })
        .join(', ')

      toast({
        title: 'Deletion Request Submitted',
        description: `Your organization ${reasons ? `(${reasons})` : ''} requires manual review. A support ticket has been created and our team will process your request.`,
        duration: TOAST_LONG_DURATION,
      })
      setShowDeleteModal(false)
    }
  }, [deleteOrganization, organization.id, router])

  return (
    <>
      <SettingsGroup>
        <SettingsGroupItem
          title="Delete Organization"
          description="Permanently delete this organization and all associated data. This action cannot be undone."
        >
          <Button
            variant="destructive"
            onClick={() => setShowDeleteModal(true)}
            size="sm"
          >
            Delete
          </Button>
        </SettingsGroupItem>
      </SettingsGroup>

      <ConfirmModal
        isShown={showDeleteModal}
        hide={() => setShowDeleteModal(false)}
        title="Delete Organization"
        description={`Are you sure you want to delete "${organization.name}"? This action cannot be undone.`}
        body={
          <div className="dark:text-polar-400 text-sm text-gray-600">
            <p className="mb-2">When you delete an organization:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Organization data will be anonymized and marked as deleted
              </li>
              <li>
                If you have orders or active subscriptions, a support ticket
                will be created for manual review
              </li>
              <li>
                Connected Stripe account will be deleted if no blocking
                conditions exist
              </li>
            </ul>
          </div>
        }
        onConfirm={handleDelete}
        destructive
        destructiveText="Delete"
        confirmPrompt={organization.slug}
      />
    </>
  )
}
