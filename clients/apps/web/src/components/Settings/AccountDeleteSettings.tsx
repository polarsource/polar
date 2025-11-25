'use client'

import { useAuth } from '@/hooks/auth'
import { useDeleteUser } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

const TOAST_LONG_DURATION = 8000

export default function AccountDeleteSettings() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const deleteUser = useDeleteUser()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleDelete = useCallback(async () => {
    try {
      const { data } = await deleteUser.mutateAsync()

      if (!data) {
        toast({
          title: 'Deletion Failed',
          description: 'An error occurred while deleting your account.',
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
        // Redirect to logout
        router.push(`${CONFIG.BASE_URL}/v1/auth/logout`)
      } else if (data.blocked_reasons && data.blocked_reasons.length > 0) {
        const blockingOrgNames = (data.blocking_organizations ?? [])
          .map((org) => org.name)
          .join(', ')

        toast({
          title: 'Cannot Delete Account',
          description: `You must delete your organizations first: ${blockingOrgNames}`,
          variant: 'error',
          duration: TOAST_LONG_DURATION,
        })
        setShowDeleteModal(false)
      }
    } catch {
      toast({
        title: 'Deletion Failed',
        description: 'An error occurred while deleting your account.',
        variant: 'error',
        duration: TOAST_LONG_DURATION,
      })
    }
  }, [deleteUser, router])

  if (!currentUser) {
    return null
  }

  return (
    <>
      <SettingsGroup>
        <SettingsGroupItem
          title="Delete Account"
          description="Permanently delete your account and all associated data. This action cannot be undone."
          vertical
        >
          <div className="flex flex-col gap-4">
            <div className="dark:text-polar-400 text-sm text-gray-600">
              <p className="mb-2">When you delete your account:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Your email and personal data will be anonymized</li>
                <li>Your OAuth connections will be removed</li>
                <li>
                  You must delete all your organizations first before deleting
                  your account
                </li>
              </ul>
            </div>
            <div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </SettingsGroupItem>
      </SettingsGroup>

      <ConfirmModal
        isShown={showDeleteModal}
        hide={() => setShowDeleteModal(false)}
        title="Delete Account"
        description={`Are you sure you want to delete your account? This action cannot be undone.`}
        onConfirm={handleDelete}
        destructive
        destructiveText="Delete"
        confirmPrompt={currentUser.email}
      />
    </>
  )
}
