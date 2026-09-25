import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ScanFailurePanel } from './ScanFailurePanel'
import {
  CATALOG_EMPTY_COPY,
  CATALOG_REFRESH_COPY,
  type ReviewCatalogEmptyKind,
} from './reviewCatalog'

interface Props {
  kind: ReviewCatalogEmptyKind
  migrationId?: string
  error?: string
  onRerunPrecheck?: () => void
  rerunning?: boolean
}

export function CatalogEmptyPanel({
  kind,
  migrationId,
  error,
  onRerunPrecheck,
  rerunning = false,
}: Props) {
  if (!rerunning && error && migrationId) {
    return (
      <ScanFailurePanel
        migrationId={migrationId}
        error={error}
        onRetry={onRerunPrecheck}
        retrying={rerunning}
      />
    )
  }

  const { title, description } = rerunning
    ? CATALOG_REFRESH_COPY
    : CATALOG_EMPTY_COPY[kind]

  return (
    <Box
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      paddingVertical="3xl"
      paddingHorizontal="xl"
      flexDirection="column"
      alignItems="center"
      rowGap="l"
      textAlign="center"
    >
      <Box flexDirection="column" rowGap="xs" alignItems="center">
        <Text variant="heading-xs" as="h3">
          {title}
        </Text>
        <Text variant="caption" color="muted">
          {description}
        </Text>
      </Box>
      {onRerunPrecheck && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRerunPrecheck}
          disabled={rerunning}
        >
          {rerunning ? 'Refreshing…' : 'Refresh from Stripe'}
        </Button>
      )}
    </Box>
  )
}
