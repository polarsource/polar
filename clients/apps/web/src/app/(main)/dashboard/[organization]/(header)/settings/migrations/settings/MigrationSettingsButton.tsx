'use client'

import { useModal } from '@/components/Modal/useModal'
import { useIsSettingMigrationTaxBehavior } from '@/hooks/queries/merchantMigrations'
import { Button, Modal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SlidersHorizontal } from 'lucide-react'
import { MigrationSettingsPanel } from './MigrationSettingsPanel'

export function MigrationSettingsButton({
  migrationId,
  disabled,
}: {
  migrationId: string
  disabled: boolean
}) {
  const { isShown, show, hide } = useModal()
  // Closing mid-request would drop its result and allow a second apply.
  const busy = useIsSettingMigrationTaxBehavior(migrationId)

  return (
    <>
      <Button size="sm" variant="ghost" onClick={show} disabled={disabled}>
        <Box as="span" display="inline-flex" alignItems="center" columnGap="xs">
          <SlidersHorizontal size={14} />
          Advanced
        </Box>
      </Button>
      <Modal
        title="Advanced settings"
        isShown={isShown}
        hide={() => {
          if (!busy) hide()
        }}
        modalContent={
          <Box flexDirection="column" padding="xl">
            <MigrationSettingsPanel migrationId={migrationId} />
          </Box>
        }
      />
    </>
  )
}
