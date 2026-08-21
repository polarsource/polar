import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { SWITCH_INTRO } from './switchCopy'

const numberFormat = new Intl.NumberFormat('en-US')

export function SwitchSummary({
  report,
}: {
  report: schemas['MerchantMigrationCutoverReport']
}) {
  const toSwitch = Math.max(0, report.total - report.moved)
  const parts = [
    `${numberFormat.format(report.total)} imported`,
    `${numberFormat.format(report.moved)} switched`,
    `${numberFormat.format(toSwitch)} to switch`,
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
