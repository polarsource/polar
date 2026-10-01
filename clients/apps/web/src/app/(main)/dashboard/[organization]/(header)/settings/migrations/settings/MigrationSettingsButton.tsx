'use client'

import { Button, Modal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SlidersHorizontal } from 'lucide-react'
import { useCallback, useState } from 'react'
import { MigrationSettingsPanel } from './MigrationSettingsPanel'

export function MigrationSettingsButton({
  migrationId,
  disabled = false,
}: {
  migrationId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(() => new Set())

  const onBusyChange = useCallback((key: string, value: boolean) => {
    setBusy((prev) => {
      if (prev.has(key) === value) return prev
      const next = new Set(prev)
      if (value) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])
  const hide = () => {
    if (busy.size === 0) setOpen(false)
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Box as="span" display="inline-flex" alignItems="center" columnGap="xs">
          <SlidersHorizontal size={14} />
          Advanced
        </Box>
      </Button>
      <Modal
        title="Advanced settings"
        isShown={open}
        hide={hide}
        modalContent={
          <Box flexDirection="column" padding="xl">
            <MigrationSettingsPanel
              migrationId={migrationId}
              onBusyChange={onBusyChange}
            />
          </Box>
        }
      />
    </>
  )
}
