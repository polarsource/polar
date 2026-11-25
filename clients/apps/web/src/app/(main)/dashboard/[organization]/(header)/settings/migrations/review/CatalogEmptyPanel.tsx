import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CATALOG_READ_STALLED } from '../catalogReadCopy'
import {
  CATALOG_CONTINUE_ERROR_TITLE,
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
  onContinue?: () => void
  continuing?: boolean
  continueError?: string
}

export function CatalogEmptyPanel({
  kind,
  onRerunPrecheck,
  rerunning = false,
  readError,
  stalled = false,
  onContinue,
  continuing = false,
  continueError,
}: Props) {
  const refreshing = rerunning && !stalled
  const canContinue = kind === 'benefits_only' && onContinue !== undefined
  const continueFailure = canContinue ? continueError : undefined
  const error = readError ?? continueFailure
  const failed = Boolean(error) && !rerunning
  const { title, description } = rerunning
    ? {
        title: CATALOG_REFRESH_COPY.title,
        description: stalled
          ? CATALOG_READ_STALLED
          : CATALOG_REFRESH_COPY.description,
      }
    : readError
      ? { title: CATALOG_READ_ERROR_TITLE, description: readError }
      : continueFailure
        ? { title: CATALOG_CONTINUE_ERROR_TITLE, description: continueFailure }
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
        <Text variant="title" as="h3" color={failed ? 'danger' : 'default'}>
          {title}
        </Text>
        <Text color="muted">{description}</Text>
      </Box>
      <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
        {onRerunPrecheck && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRerunPrecheck}
            disabled={refreshing || continuing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh catalog'}
          </Button>
        )}
        {canContinue && (
          <Button
            size="sm"
            onClick={onContinue}
            disabled={continuing || rerunning}
          >
            {continuing ? 'Continuing…' : 'Continue to benefits'}
          </Button>
        )}
      </Box>
    </Box>
  )
}
