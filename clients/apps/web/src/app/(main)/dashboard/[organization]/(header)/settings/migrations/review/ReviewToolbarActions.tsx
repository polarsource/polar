import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MigrationSettingsButton } from '../settings/MigrationSettingsButton'
import { ReviewPrimaryAction } from './reviewCatalog'

const numberFormat = new Intl.NumberFormat('en-US')

export function ReviewToolbarActions({
  migrationId,
  primaryAction,
  canPrepare,
  importCount,
  importing,
  refreshing,
  onRerunPrecheck,
  onContinue,
  onImport,
}: {
  migrationId: string
  primaryAction: ReviewPrimaryAction
  canPrepare: boolean
  importCount: number
  importing: boolean
  refreshing: boolean
  onRerunPrecheck?: () => void
  onContinue: () => void
  onImport: () => void
}) {
  const prepareLabel = importing
    ? 'Preparing…'
    : importCount > 0
      ? `Prepare ${numberFormat.format(importCount)} ${
          importCount === 1 ? 'subscription' : 'subscriptions'
        }`
      : 'Prepare subscriptions'

  return (
    <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
      <MigrationSettingsButton
        migrationId={migrationId}
        disabled={importing || refreshing}
      />
      {onRerunPrecheck && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRerunPrecheck}
          disabled={refreshing || importing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from Stripe'}
        </Button>
      )}
      {primaryAction === 'continue' ? (
        <Button
          size="sm"
          onClick={onContinue}
          disabled={importing || refreshing}
        >
          {importing ? 'Continuing…' : 'Continue'}
        </Button>
      ) : canPrepare ? (
        <Button
          size="sm"
          onClick={onImport}
          disabled={importing || importCount <= 0}
        >
          {prepareLabel}
        </Button>
      ) : null}
    </Box>
  )
}
