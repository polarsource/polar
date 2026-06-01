'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'

interface BackupCodesRegenerateModalProps {
  isShown: boolean
  hide: () => void
  onRegenerate: () => Promise<{ codes: string[] } | null>
}

export default function BackupCodesRegenerateModal({
  isShown,
  hide,
  onRegenerate,
}: BackupCodesRegenerateModalProps) {
  const handleConfirm = async () => {
    await onRegenerate()
    hide()
  }

  return (
    <ConfirmModal
      isShown={isShown}
      hide={hide}
      title="Regenerate Backup Codes"
      description="Are you sure you want to regenerate your backup codes? This will invalidate all existing backup codes and generate new ones."
      destructive
      destructiveText="Regenerate"
      onConfirm={handleConfirm}
    />
  )
}
