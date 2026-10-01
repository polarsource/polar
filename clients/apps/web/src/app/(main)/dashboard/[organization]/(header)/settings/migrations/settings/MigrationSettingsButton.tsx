'use client'

import { Button, Modal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { MigrationSettingsPanel } from './MigrationSettingsPanel'

export function MigrationSettingsButton({
  migrationId,
  disabled,
}: {
  migrationId: string
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)

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
        hide={() => setOpen(false)}
        modalContent={
          <Box flexDirection="column" padding="xl">
            <MigrationSettingsPanel migrationId={migrationId} />
          </Box>
        }
      />
    </>
  )
}
