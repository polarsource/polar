import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CATALOG_EMPTY_COPY,
  ReviewCatalogEmptyKind,
} from './reviewCatalog'

interface Props {
  kind: ReviewCatalogEmptyKind
  onRerunPrecheck?: () => void
  rerunning?: boolean
}

export function CatalogEmptyPanel({
  kind,
  onRerunPrecheck,
  rerunning = false,
}: Props) {
  const { title, description } = CATALOG_EMPTY_COPY[kind]

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
