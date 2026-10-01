'use client'

import {
  Button,
  InlineModal,
  InlineModalHeader,
  Modal,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { MigrationSettingsPanel } from './MigrationSettingsPanel'

const TITLE = 'Advanced settings'

// Temporary: `?bulkTax=drawer` opens the settings in the side drawer instead
// of the centered modal, while the two are compared.
const useDrawer = () => useSearchParams().get('bulkTax') === 'drawer'

export function MigrationSettingsButton({
  migrationId,
  disabled = false,
}: {
  migrationId: string
  disabled?: boolean
}) {
  const drawer = useDrawer()
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

  const panel = (
    <MigrationSettingsPanel
      migrationId={migrationId}
      onBusyChange={onBusyChange}
    />
  )

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
      {drawer ? (
        <InlineModal
          isShown={open}
          hide={hide}
          modalContent={
            <Box flexDirection="column" height="100%">
              <InlineModalHeader hide={hide}>
                <Text variant="heading-xs" as="h2">
                  {TITLE}
                </Text>
              </InlineModalHeader>
              <Box flexDirection="column" padding="xl" overflowY="auto">
                {panel}
              </Box>
            </Box>
          }
        />
      ) : (
        <Modal
          title={TITLE}
          isShown={open}
          hide={hide}
          modalContent={<Box padding="xl">{panel}</Box>}
        />
      )}
    </>
  )
}
