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
      title="Regenerate backup codes?"
      description="Your current backup codes will stop working immediately and be replaced with new backup codes."
      destructive
      destructiveText="Regenerate"
      onConfirm={handleConfirm}
    />
  )
}
