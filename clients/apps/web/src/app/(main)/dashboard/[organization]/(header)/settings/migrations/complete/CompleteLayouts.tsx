import { schemas } from '@polar-sh/client'
import { Alert, Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { COMPLETE_INTRO, COMPLETE_TITLE } from './completeCopy'
import { CompleteSummary, completeStats } from './CompleteSummary'
import { IdLookup } from './IdLookup'
import { MappingKind, MappingRow } from './idMapping'
import { MappingTable } from './MappingTable'
import { downloadMapping } from './mappingExport'
import { NextSteps } from './NextSteps'

export type CompleteLayout = 'stacked' | 'split' | 'lookup'

export const COMPLETE_LAYOUTS: CompleteLayout[] = ['stacked', 'split', 'lookup']

export interface LayoutProps {
  report: schemas['MerchantMigrationCutoverReport']
  mapping: Record<MappingKind, MappingRow[]>
  organizationSlug: string
  onReviewLeftOnStripe: () => void
}

const numberFormat = new Intl.NumberFormat('en-US')

function CompleteHeader() {
  return (
    <Box flexDirection="column" rowGap="xs">
      <Text variant="heading-xs" as="h2">
        {COMPLETE_TITLE}
      </Text>
      <Text variant="caption" color="muted">
        {COMPLETE_INTRO}
      </Text>
    </Box>
  )
}

function LeftOnStripeAlert({ report, onReviewLeftOnStripe }: LayoutProps) {
  const left = report.skipped + report.failed + report.pending
  if (left === 0) return null
  return (
    <Alert
      variant="warning"
      title={`${numberFormat.format(left)} subscriptions still bill on Stripe`}
      description="They were skipped or failed during the switch. Review the reasons and switch them when they're ready."
      actions={[{ text: 'Review and switch', onClick: onReviewLeftOnStripe }]}
    />
  )
}

function MappingSection(props: LayoutProps & { showExport?: boolean }) {
  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Stripe → Polar ID map
        </Text>
        <Text variant="caption" color="muted">
          Every Stripe object this migration read, and the Polar object it
          became.
        </Text>
      </Box>
      <MappingTable
        mapping={props.mapping}
        organizationSlug={props.organizationSlug}
        showExport={props.showExport}
      />
    </Box>
  )
}

export function StackedLayout(props: LayoutProps) {
  return (
    <Box flexDirection="column" rowGap="2xl">
      <CompleteHeader />
      <CompleteSummary stats={completeStats(props.report, props.mapping)} />
      <LeftOnStripeAlert {...props} />
      <MappingSection {...props} />
      <NextSteps organizationSlug={props.organizationSlug} />
    </Box>
  )
}

export function SplitLayout(props: LayoutProps) {
  return (
    <Box flexDirection="column" rowGap="xl">
      <CompleteHeader />
      <LeftOnStripeAlert {...props} />
      <Grid
        templateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) 300px' }}
        gap="2xl"
        alignItems="start"
      >
        <MappingSection {...props} showExport={false} />
        <Box as="aside" flexDirection="column" rowGap="xl">
          <CompleteSummary
            stats={completeStats(props.report, props.mapping)}
            columns="repeat(2, 1fr)"
          />
          <Box flexDirection="column" rowGap="s">
            <Button onClick={() => downloadMapping(props.mapping, 'csv')}>
              Download ID map (CSV)
            </Button>
            <Button
              variant="secondary"
              onClick={() => downloadMapping(props.mapping, 'json')}
            >
              Download as JSON
            </Button>
          </Box>
          <NextSteps organizationSlug={props.organizationSlug} compact />
        </Box>
      </Grid>
    </Box>
  )
}

export function LookupLayout(props: LayoutProps) {
  return (
    <Box flexDirection="column" rowGap="2xl">
      <CompleteHeader />
      <CompleteSummary
        stats={completeStats(props.report, props.mapping)}
        columns="repeat(6, 1fr)"
      />
      <LeftOnStripeAlert {...props} />
      <Box
        padding="xl"
        borderRadius="l"
        backgroundColor="background-card"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <IdLookup
          mapping={props.mapping}
          organizationSlug={props.organizationSlug}
        />
      </Box>
      <MappingSection {...props} />
      <NextSteps organizationSlug={props.organizationSlug} />
    </Box>
  )
}
