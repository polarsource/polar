'use client'

import { useDeleteUser } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useCallback, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

const TOAST_LONG_DURATION = 8000

export default function UserDeleteSettings() {
  const deleteUser = useDeleteUser()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDelete = useCallback(async () => {
    const { data, error } = await deleteUser.mutateAsync()

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
        title: 'Account Deleted',
        description: 'Your account has been successfully deleted.',
        variant: 'success',
        duration: TOAST_LONG_DURATION,
      })
      window.location.href = `${CONFIG.BASE_URL}/v1/auth/logout`
    } else {
      const organizations = data.blocking_organizations ?? []
      const orgNames = organizations.map((o) => o.name).join(', ')
      toast({
        title: 'Deletion Blocked',
        description: `You must delete all your organizations before deleting your account.${orgNames ? ` Blocking organizations: ${orgNames}.` : ''}`,
        variant: 'error',
        duration: TOAST_LONG_DURATION,
      })
      setShowDeleteModal(false)
    }
  }, [deleteUser])

  return (
    <>
      <SettingsGroup>
        <SettingsGroupItem
          title="Delete Account"
          description="Permanently delete your account and all associated data. This action cannot be undone."
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
        title="Delete Account"
        description="Are you sure you want to delete your account? This action cannot be undone."
        body={
          <div className="dark:text-polar-400 text-sm text-gray-600">
            <p className="mb-2">When you delete your account:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Your email and personal data will be anonymized</li>
              <li>Your OAuth connections will be deleted</li>
              <li>
                All your organizations must be deleted before your account can
                be removed
              </li>
            </ul>
          </div>
        }
        onConfirm={handleDelete}
        destructive
        destructiveText="Delete"
      />
    </>
  )
}
