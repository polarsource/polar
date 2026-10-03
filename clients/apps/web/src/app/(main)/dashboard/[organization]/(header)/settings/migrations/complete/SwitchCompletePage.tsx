'use client'

import { useMigrationSwitch } from '@/hooks/queries/merchantMigrations'
import { Alert, Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SwitchPanel } from '../switch/SwitchPanel'
import { SwitchSummary } from './SwitchSummary'
import { useIdMapping } from './useIdMapping'

const numberFormat = new Intl.NumberFormat('en-US')

// While batches remain, the switch table leads and the summary is a click
// away; once nothing is left to switch, it's the other way round.
export function SwitchCompletePage({
  migrationId,
  organizationId,
  organizationSlug,
  complete,
}: {
  migrationId: string
  organizationId: string
  organizationSlug: string
  complete: boolean
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const defaultView = complete ? 'summary' : 'switch'
  const view = searchParams.get('view') ?? defaultView
  const report = useMigrationSwitch(migrationId)
  const mapping = useIdMapping(
    view === 'summary' ? migrationId : '',
    organizationId,
  )

  const openView = (next: string) =>
    router.push(next === defaultView ? pathname : `${pathname}?view=${next}`)

  if (view === 'switch') {
    const moved = report.data?.moved ?? 0
    return (
      <Box flexDirection="column" rowGap="l">
        {complete ? (
          <BackLink
            label="Back to summary"
            onClick={() => openView('summary')}
          />
        ) : (
          moved > 0 && (
            <Box
              alignItems="center"
              justifyContent="between"
              columnGap="m"
              padding="m"
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text variant="caption">
                {numberFormat.format(moved)} subscriptions already bill on
                Polar, and their Polar IDs are ready.
              </Text>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openView('summary')}
              >
                View ID map
              </Button>
            </Box>
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
  return (
    <Box flexDirection="column" rowGap="xl">
      {!complete && (
        <BackLink
          label="Back to switching"
          onClick={() => openView('switch')}
        />
      )}
      <SwitchSummary
        complete={complete}
        report={report.data}
        mapping={mapping.data}
        organizationSlug={organizationSlug}
        onOpenSwitch={() => openView('switch')}
      />
    </Box>
  )
}

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
