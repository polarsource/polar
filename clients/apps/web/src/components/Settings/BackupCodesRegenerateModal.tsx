'use client'

import TwoFactorCodeModal from './TwoFactorCodeModal'

interface BackupCodesRegenerateModalProps {
  isShown: boolean
  hide: () => void
  onRegenerate: (code: string) => Promise<{ error?: { detail?: unknown } }>
}

export default function BackupCodesRegenerateModal({
  isShown,
  hide,
  onRegenerate,
}: BackupCodesRegenerateModalProps) {
  return (
    <TwoFactorCodeModal
      isShown={isShown}
      hide={hide}
      title="Regenerate backup codes?"
      description="Your current backup codes will stop working immediately and be replaced with new backup codes."
      destructive
      confirmLabel="Regenerate"
      onConfirm={onRegenerate}
    />
  )
}
