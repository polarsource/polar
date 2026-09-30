import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CATALOG_READ_STALLED } from '../catalogReadCopy'
import {
  CATALOG_EMPTY_COPY,
  CATALOG_READ_ERROR_TITLE,
  CATALOG_REFRESH_COPY,
  type ReviewCatalogEmptyKind,
} from './reviewCatalog'

interface Props {
  kind: ReviewCatalogEmptyKind
  onRerunPrecheck?: () => void
  rerunning?: boolean
  readError?: string
  stalled?: boolean
}

export function CatalogEmptyPanel({
  kind,
  onRerunPrecheck,
  rerunning = false,
  readError,
  stalled = false,
}: Props) {
  const refreshing = rerunning && !stalled
  const failed = Boolean(readError) && !rerunning
  const { title, description } = rerunning
    ? {
        title: CATALOG_REFRESH_COPY.title,
        description: stalled
          ? CATALOG_READ_STALLED
          : CATALOG_REFRESH_COPY.description,
      }
    : readError
      ? { title: CATALOG_READ_ERROR_TITLE, description: readError }
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
        <Text
          variant="heading-xs"
          as="h3"
          color={failed ? 'danger' : 'default'}
        >
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
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh from Stripe'}
        </Button>
      )}
    </Box>
  )
}
