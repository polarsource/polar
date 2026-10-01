import { schemas } from '@polar-sh/client'
import { Alert, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PHASE_INTRO, phaseTitle, SwitchPhase } from '../completeCopy'
import { MappingKind, MappingRow } from '../idMapping'

export interface LayoutProps {
  migrationId: string
  organizationId: string
  organizationSlug: string
  phase: SwitchPhase
  report: schemas['MerchantMigrationCutoverReport']
  mapping: Record<MappingKind, MappingRow[]>
  onOpenSwitch: () => void
}

export const numberFormat = new Intl.NumberFormat('en-US')

export function PhaseHeader({ phase, report, mapping }: LayoutProps) {
  return (
    <Box flexDirection="column" rowGap="xs">
      <Text variant="heading-xs" as="h2">
        {phaseTitle(phase, report.moved, mapping.subscriptions.length)}
      </Text>
      <Text variant="caption" color="muted">
        {PHASE_INTRO[phase]}
      </Text>
    </Box>
  )
}

export function LeftOnStripeAlert({ report, onOpenSwitch }: LayoutProps) {
  if (report.pending > 0) {
    return (
      <Alert
        variant="info"
        title={`${numberFormat.format(report.pending)} subscriptions are ready for the next batch`}
        description="They still bill on Stripe until you switch them."
        actions={[{ text: 'Continue switching', onClick: onOpenSwitch }]}
      />
    )
  }
  const left = report.skipped + report.failed
  if (left === 0) return null
  return (
    <Alert
      variant="warning"
      title={`${numberFormat.format(left)} subscriptions still bill on Stripe`}
      description="They were skipped or failed during the switch. Review the reasons and switch them when they're ready."
      actions={[{ text: 'Review and switch', onClick: onOpenSwitch }]}
    />
  )
}

export function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <Box flexDirection="column" rowGap="xs">
      <Text variant="heading-xxs" as="h3">
        {title}
      </Text>
      {description && (
        <Text variant="caption" color="muted">
          {description}
        </Text>
      )}
    </Box>
  )
}

export function Panel({ children }: { children: React.ReactNode }) {
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
      {children}
    </Box>
  )
}
