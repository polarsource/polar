'use client'

import {
  useBackupCodesEnroll,
  useBackupCodesStatus,
  useTOTPStatus,
  useTOTPDelete,
} from '@/hooks'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import ListGroup from '@polar-sh/ui/components/atoms/ListGroup'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { useState } from 'react'
import TOTPSetupModal from './TOTPSetupModal'
import BackupCodesModal from './BackupCodesModal'
import BackupCodesRegenerateModal from './BackupCodesRegenerateModal'

const AuthenticationMethod = ({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: React.ReactNode
  action: React.ReactNode
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
        <div className="self-start">{icon}</div>
        <div className="grow">
          <div className="font-medium">{title}</div>
          <div className="dark:text-polar-500 text-sm text-gray-500">
            {subtitle}
          </div>
        </div>
        <div className="flex-0">{action}</div>
      </div>
    </div>
  )
}

const TwoFactorSettings = () => {
  const totpStatus = useTOTPStatus()
  const totpDelete = useTOTPDelete()
  const backupCodesStatus = useBackupCodesStatus()
  const backupCodesEnroll = useBackupCodesEnroll()

  const {
    isShown: isTOTPModalShown,
    show: showTOTPModal,
    hide: hideTOTPModal,
  } = useModal()

  const {
    isShown: isDeleteConfirmShown,
    show: showDeleteConfirmModal,
    hide: hideDeleteConfirmModal,
  } = useModal()

  const {
    isShown: isBackupCodesModalShown,
    show: showBackupCodesModal,
    hide: hideBackupCodesModal,
  } = useModal()

  const {
    isShown: isBackupCodesRegenerateModalShown,
    show: showBackupCodesRegenerateModal,
    hide: hideBackupCodesRegenerateModal,
  } = useModal()

  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)

  const handleDeleteTOTP = async () => {
    await totpDelete.mutateAsync()
    await totpStatus.refetch()
    hideDeleteConfirmModal()
  }

  return (
    <div>
      <ListGroup>
        <ListGroup.Item>
          <AuthenticationMethod
            icon={<VerifiedUserOutlined />}
            title="Authenticator App"
            subtitle={
              totpStatus.data?.enabled
                ? 'Use an authenticator app to sign in.'
                : 'Add an extra layer of security to your account.'
            }
            action={
              totpStatus.data?.enabled ? (
                <Button
                  variant="secondary"
                  onClick={showDeleteConfirmModal}
                  loading={totpDelete.isPending}
                >
                  Disable
                </Button>
              ) : (
                <Button onClick={showTOTPModal}>Set Up</Button>
              )
            }
          />
        </ListGroup.Item>

        <ListGroup.Item>
          <AuthenticationMethod
            icon={<KeyOutlined />}
            title="Backup Codes"
            subtitle={
              backupCodesStatus.data
                ? `${backupCodesStatus.data.codes - backupCodesStatus.data.used_codes} remaining`
                : 'Generate backup codes for emergency access.'
            }
            action={
              backupCodesStatus.data?.codes &&
              backupCodesStatus.data.codes > 0 ? (
                <Button
                  variant="secondary"
                  onClick={showBackupCodesRegenerateModal}
                  loading={backupCodesEnroll.isPending}
                >
                  Regenerate
                </Button>
              ) : totpStatus.data?.enabled ? (
                <Button
                  onClick={async () => {
                    const result = await backupCodesEnroll.mutateAsync()
                    if (result.data?.codes) {
                      setNewBackupCodes(result.data.codes)
                      await backupCodesStatus.refetch()
                      showBackupCodesModal()
                    }
                  }}
                  loading={backupCodesEnroll.isPending}
                >
                  Generate
                </Button>
              ) : null
            }
          />
        </ListGroup.Item>
      </ListGroup>

      <TOTPSetupModal isShown={isTOTPModalShown} hide={hideTOTPModal} />

      <ConfirmModal
        isShown={isDeleteConfirmShown}
        hide={hideDeleteConfirmModal}
        title="Disable Authenticator App"
        description="Are you sure you want to disable your authenticator app? Your account will be less secure without two-factor authentication."
        destructive
        destructiveText="Disable"
        onConfirm={handleDeleteTOTP}
      />

      <BackupCodesRegenerateModal
        isShown={isBackupCodesRegenerateModalShown}
        hide={hideBackupCodesRegenerateModal}
        onRegenerate={async () => {
          const result = await backupCodesEnroll.mutateAsync()
          if (result.data?.codes) {
            setNewBackupCodes(result.data.codes)
            await backupCodesStatus.refetch()
            showBackupCodesModal()
            return result.data
          }
          return null
        }}
      />

      <BackupCodesModal
        isShown={isBackupCodesModalShown}
        hide={hideBackupCodesModal}
        codes={newBackupCodes || []}
      />
    </div>
  )
}

export default TwoFactorSettings
