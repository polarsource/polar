import { schemas } from '@polar-sh/client'
import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { IdMapping } from './idMapping'
import { MappingTable } from './MappingTable'

const numberFormat = new Intl.NumberFormat('en-US')
const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const NEXT_STEPS: [string, string?, string?][] = [
  ['Swap the Stripe IDs in your database for the Polar IDs in the export'],
  [
    'Grant and revoke access from Polar webhooks',
    'settings/webhooks',
    'Webhooks',
  ],
  [
    'Turn off the Stripe webhooks and emails that react to the cancelled subscriptions',
  ],
  [
    'Send new customers to Polar checkout links',
    'products/checkout-links',
    'Checkout links',
  ],
]

interface Props {
  complete: boolean
  report: schemas['MerchantMigrationCutoverReport']
  mapping: IdMapping
  organizationSlug: string
  onOpenSwitch: () => void
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box
      flexDirection="column"
      rowGap="m"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text variant="heading-xxs" as="h3">
        {title}
      </Text>
      {children}
    </Box>
  )
}

// The switch can run in batches, so this reads right after any of them: the
// bar fills up, the batch list grows, and the map covers what already moved.
export function SwitchSummary({
  complete,
  report,
  mapping,
  organizationSlug,
  onOpenSwitch,
}: Props) {
  const total = mapping.subscriptions.length
  const left = report.skipped + report.failed
  const perDay = new Map<string, number>()
  for (const { switchedAt } of mapping.subscriptions) {
    if (!switchedAt) continue
    const day = switchedAt.slice(0, 10)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const batches = [...perDay].toSorted(([a], [b]) => a.localeCompare(b))
  const facts = [
    `${numberFormat.format(report.moved)} switched`,
    report.pending > 0 && `${numberFormat.format(report.pending)} ready`,
    report.skipped > 0 &&
      `${numberFormat.format(report.skipped)} left on Stripe`,
    report.failed > 0 && `${numberFormat.format(report.failed)} failed`,
  ].filter(Boolean)

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h2">
          {complete
            ? 'Your subscriptions are billed by Polar'
            : `${numberFormat.format(report.moved)} of ${numberFormat.format(total)} subscriptions switched so far`}
        </Text>
        <Text variant="caption" color="muted">
          {complete
            ? 'Use the ID map to point your database, webhooks and links at Polar.'
            : 'Switched subscriptions already have their Polar IDs, so you can update your systems batch by batch.'}
        </Text>
      </Box>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap="l">
        <Panel title="Subscriptions">
          <Box
            height={8}
            borderRadius="full"
            overflow="hidden"
            backgroundColor="background-card"
          >
            <Box
              width={`${(report.moved / Math.max(total, 1)) * 100}%`}
              backgroundColor="background-inverse"
            />
          </Box>
          <Box justifyContent="between" alignItems="center" columnGap="m">
            <Text variant="caption" color="muted" tabularNums>
              {facts.join('  ·  ')}
            </Text>
            {(report.pending > 0 || left > 0) && (
              <Button size="sm" variant="secondary" onClick={onOpenSwitch}>
                {report.pending > 0
                  ? 'Continue switching'
                  : 'Review what stayed'}
              </Button>
            )}
          </Box>
        </Panel>
        <Panel title="Batches">
          {batches.length === 0 && (
            <Text variant="caption" color="muted">
              Nothing switched yet.
            </Text>
          )}
          {batches.map(([day, count], index) => (
            <Box key={day} justifyContent="between">
              <Text variant="caption">
                Batch {index + 1} ·{' '}
                {dayFormat.format(new Date(`${day}T12:00:00`))}
              </Text>
              <Text variant="caption" color="muted" tabularNums>
                {numberFormat.format(count)} switched
              </Text>
            </Box>
          ))}
        </Panel>
      </Grid>

      <Box as="section" flexDirection="column" rowGap="m">
        <Text variant="heading-xxs" as="h3">
          Stripe → Polar ID map
        </Text>
        <MappingTable mapping={mapping} organizationSlug={organizationSlug} />
      </Box>

      {complete && (
        <Box as="section" flexDirection="column" rowGap="m">
          <Text variant="heading-xxs" as="h3">
            What to do next
          </Text>
          <Box as="ol" flexDirection="column" rowGap="s">
            {NEXT_STEPS.map(([step, path, label], index) => (
              <Box as="li" key={step} display="flex" columnGap="s">
                <Text variant="caption" color="muted" tabularNums>
                  {index + 1}.
                </Text>
                <Text variant="caption">{step}</Text>
                {path && (
                  <Link href={`/dashboard/${organizationSlug}/${path}`}>
                    <Text variant="caption" color="muted">
                      {label} →
                    </Text>
                  </Link>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
