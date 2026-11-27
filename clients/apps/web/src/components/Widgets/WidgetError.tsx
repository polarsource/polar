import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const WidgetError = ({
  title,
  onRetry,
}: {
  title: string
  onRetry: () => void
}) => (
  <Box
    flex={1}
    flexDirection="column"
    justifyContent="end"
    alignItems="start"
    rowGap="s"
    paddingBottom="xl"
  >
    <Text>{title}</Text>
    <Button variant="secondary" size="sm" onClick={onRetry}>
      Retry
    </Button>
  </Box>
)
