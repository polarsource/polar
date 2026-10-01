import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const numberFormat = new Intl.NumberFormat('en-US')

// Between batches the merchant already has subscriptions on Polar, and needs
// their IDs before the next batch, not at the very end.
export function SwitchedSoFarBanner({
  report,
  onOpenSummary,
}: {
  report: schemas['MerchantMigrationCutoverReport']
  onOpenSummary: () => void
}) {
  if (report.moved === 0) return null
  return (
    <Box
      alignItems="center"
      justifyContent="between"
      columnGap="m"
      rowGap="s"
      flexWrap="wrap"
      padding="m"
      borderRadius="m"
      backgroundColor="background-success"
    >
      <Text variant="caption">
        {numberFormat.format(report.moved)} of{' '}
        {numberFormat.format(report.total)} subscriptions already bill on Polar.
        Their Polar IDs are ready.
      </Text>
      <Button size="sm" variant="secondary" onClick={onOpenSummary}>
        View ID map and progress
      </Button>
    </Box>
  )
}
