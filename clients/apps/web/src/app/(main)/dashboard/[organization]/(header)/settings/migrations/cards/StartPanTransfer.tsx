'use client'

import { useStartPanTransfer } from '@/hooks/queries/merchantMigrations'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export function StartPanTransfer({ migrationId }: { migrationId: string }) {
  const start = useStartPanTransfer(migrationId)

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Text variant="heading-xs" as="h3">
        Move saved cards
      </Text>
      <Text variant="caption" color="muted">
        Your catalog is imported. Next we move the cards your customers already
        saved, so Polar can charge them. This is a checklist you can leave and
        come back to. You can still import more records until you start.
      </Text>

      {start.error && (
        <Text variant="caption" color="danger" role="alert">
          {start.error.message}
        </Text>
      )}

      <Box>
        {/* In-flight only. Disabling on success strands the merchant if the
            refetch that unmounts this card never lands; a second click is
            merely a recoverable "already started". */}
        <Button
          size="sm"
          onClick={() => start.mutate()}
          disabled={start.isPending}
        >
          {start.isPending ? 'Starting…' : 'Start moving cards'}
        </Button>
      </Box>
    </Box>
  )
}
