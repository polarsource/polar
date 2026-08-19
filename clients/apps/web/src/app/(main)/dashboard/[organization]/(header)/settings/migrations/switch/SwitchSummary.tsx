import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SWITCH_INTRO } from './switchCopy'

const numberFormat = new Intl.NumberFormat('en-US')

// The one-line tally above the table: how many subscriptions were imported, how
// many Polar bills now, and how many are still waiting to be switched.
export function SwitchSummary({
  report,
}: {
  report: schemas['MerchantMigrationCutoverReport']
}) {
  const parts = [
    `${numberFormat.format(report.total)} imported`,
    `${numberFormat.format(report.moved)} switched`,
    `${numberFormat.format(report.pending)} to switch`,
  ]
  const left = report.skipped + report.failed
  if (left > 0) {
    parts.push(`${numberFormat.format(left)} left on Stripe`)
  }

  return (
    <Box flexDirection="column" rowGap="xs">
      <Text variant="caption" color="muted">
        {SWITCH_INTRO}
      </Text>
      <Text variant="caption" tabularNums>
        {parts.join('  ·  ')}
      </Text>
    </Box>
  )
}
