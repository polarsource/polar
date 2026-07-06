'use client'

import {
  useBackupCodesEnroll,
  useBackupCodesStatus,
  useTOTPStatus,
  useTOTPDelete,
} from '@/hooks'
import { Button } from '@polar-sh/orbit'
import { ListGroup } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { useState } from 'react'
import TOTPSetupModal from './TOTPSetupModal'
import BackupCodesModal from './BackupCodesModal'
import BackupCodesRegenerateModal from './BackupCodesRegenerateModal'
import TwoFactorCodeModal from './TwoFactorCodeModal'
import { toast } from '../Toast/use-toast'
import { KeyRoundIcon, ShieldCheckIcon } from 'lucide-react'

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

  const {
    isShown: isBackupCodesGenerateModalShown,
    show: showBackupCodesGenerateModal,
    hide: hideBackupCodesGenerateModal,
  } = useModal()

  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)

  const handleDeleteTOTP = async (code: string) => {
    const result = await totpDelete.mutateAsync(code)
    if (!result.error) {
      await totpStatus.refetch()
      toast({ title: 'Two-factor authentication disabled' })
    }
    return result
  }

  const handleBackupCodesEnroll = async (code?: string) => {
    const result = await backupCodesEnroll.mutateAsync(code)
    if (result.data?.codes) {
      setNewBackupCodes(result.data.codes)
      await backupCodesStatus.refetch()
      showBackupCodesModal()
    }
    return result
  }

  return (
    <div>
      <ListGroup>
        <ListGroup.Item>
          <AuthenticationMethod
            icon={<ShieldCheckIcon />}
            title="Authenticator App"
            subtitle={
              totpStatus.data?.enabled
                ? "You're using an authenticator app to sign in securely."
                : 'Add an extra layer of security when you sign in.'
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

        {totpStatus.data?.enabled && (
          <ListGroup.Item>
            <AuthenticationMethod
              icon={<KeyRoundIcon />}
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
                ) : (
                  <Button
                    onClick={showBackupCodesGenerateModal}
                    loading={backupCodesEnroll.isPending}
                  >
                    Generate
                  </Button>
                )
              }
            />
          </ListGroup.Item>
        )}
      </ListGroup>

      <TOTPSetupModal
        isShown={isTOTPModalShown}
        hide={hideTOTPModal}
        onEnabled={async (backupCodes) => {
          hideTOTPModal()
          await totpStatus.refetch()
          setNewBackupCodes(backupCodes)
          await backupCodesStatus.refetch()
          showBackupCodesModal()
        }}
      />

      <TwoFactorCodeModal
        isShown={isDeleteConfirmShown}
        hide={hideDeleteConfirmModal}
        title="Disable Authenticator App?"
        description="You'll no longer be asked for a code when you sign in, and your backup codes will stop working. You can turn it back on anytime."
        destructive
        confirmLabel="Disable"
        onConfirm={handleDeleteTOTP}
      />

      <TwoFactorCodeModal
        isShown={isBackupCodesGenerateModalShown}
        hide={hideBackupCodesGenerateModal}
        title="Generate Backup Codes"
        description="Backup codes let you sign in if you lose access to your authenticator app."
        confirmLabel="Generate"
        onConfirm={handleBackupCodesEnroll}
      />

      <BackupCodesRegenerateModal
        isShown={isBackupCodesRegenerateModalShown}
        hide={hideBackupCodesRegenerateModal}
        onRegenerate={handleBackupCodesEnroll}
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
