'use client'

import { useMigrationSwitch } from '@/hooks/queries/merchantMigrations'
import { Alert, SegmentedControl, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SwitchPanel } from '../switch/SwitchPanel'
import { SwitchPhase } from './completeCopy'
import { CustomersLayout } from './layouts/CustomersLayout'
import { GoLiveLayout } from './layouts/GoLiveLayout'
import { LedgerLayout } from './layouts/LedgerLayout'
import { MinimalLayout } from './layouts/MinimalLayout'
import { ProgressLayout } from './layouts/ProgressLayout'
import { LayoutProps } from './layouts/shared'
import { SwitchedSoFarBanner } from './SwitchedSoFarBanner'
import { useIdMapping } from './useIdMapping'

// `?layout=` is a temporary switch between design versions under review.
const LAYOUTS = {
  progress: ProgressLayout,
  minimal: MinimalLayout,
  ledger: LedgerLayout,
  customers: CustomersLayout,
  golive: GoLiveLayout,
} satisfies Record<string, (props: LayoutProps) => React.ReactNode>

type LayoutKey = keyof typeof LAYOUTS

const isLayoutKey = (value: string | null): value is LayoutKey =>
  value !== null && value in LAYOUTS

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Box
      alignItems="center"
      columnGap="xs"
      color={{ base: 'text-secondary', hover: 'text-primary' }}
      cursor={{ hover: 'pointer' }}
      onClick={onClick}
    >
      <ChevronLeft size={14} />
      <Text variant="caption" color="inherit">
        {label}
      </Text>
    </Box>
  )
}

// One page for the Switch step and after it. While batches remain, the switch
// table leads and the summary is a click away; once nothing is left to
// switch, the summary leads and the switch table is the click away.
export function SwitchCompletePage({
  migrationId,
  organizationId,
  organizationSlug,
  phase,
}: {
  migrationId: string
  organizationId: string
  organizationSlug: string
  phase: SwitchPhase
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const report = useMigrationSwitch(migrationId)
  const defaultView = phase === 'complete' ? 'summary' : 'switch'
  const view = searchParams.get('view') ?? defaultView
  const mapping = useIdMapping(
    view === 'summary' ? migrationId : '',
    organizationId,
  )

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }
  const openView = (next: 'switch' | 'summary') =>
    setParam('view', next === defaultView ? null : next)

  if (view === 'switch') {
    return (
      <Box flexDirection="column" rowGap="l">
        {phase === 'complete' ? (
          <BackLink
            label="Back to summary"
            onClick={() => openView('summary')}
          />
        ) : (
          report.data && (
            <SwitchedSoFarBanner
              report={report.data}
              onOpenSummary={() => openView('summary')}
            />
          )
        )}
        <SwitchPanel migrationId={migrationId} />
      </Box>
    )
  }

  if (report.isLoading || mapping.isLoading) {
    return (
      <Box padding="3xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (!report.data || !mapping.data) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load this migration's summary"
        description="Something went wrong. Please refresh the page and try again."
      />
    )
  }

  const layoutParam = searchParams.get('layout')
  const layout: LayoutKey = isLayoutKey(layoutParam) ? layoutParam : 'progress'
  const Layout = LAYOUTS[layout]
  return (
    <Box flexDirection="column" rowGap="xl">
      {phase === 'in_progress' && (
        <BackLink
          label="Back to switching"
          onClick={() => openView('switch')}
        />
      )}
      {layoutParam !== null && (
        <Box>
          <SegmentedControl
            value={layout}
            onChange={(next) => setParam('layout', next)}
            options={Object.keys(LAYOUTS).map((key) => ({
              value: key,
              label: key,
            }))}
          />
        </Box>
      )}
      <Layout
        migrationId={migrationId}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        phase={phase}
        report={report.data}
        mapping={mapping.data}
        onOpenSwitch={() => openView('switch')}
      />
    </Box>
  )
}
