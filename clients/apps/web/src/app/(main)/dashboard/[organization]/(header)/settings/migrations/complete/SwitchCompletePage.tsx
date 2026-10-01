'use client'

import { useMigrationSwitch } from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SwitchPanel } from '../switch/SwitchPanel'
import {
  COMPLETE_LAYOUTS,
  CompleteLayout,
  LayoutProps,
  LookupLayout,
  SplitLayout,
  StackedLayout,
} from './CompleteLayouts'
import { useIdMapping } from './useIdMapping'

const LAYOUTS: Record<CompleteLayout, (props: LayoutProps) => React.ReactNode> =
  {
    stacked: StackedLayout,
    split: SplitLayout,
    lookup: LookupLayout,
  }

// `?layout=` is a temporary switch between design variants under review.
const layoutFromParam = (value: string | null): CompleteLayout =>
  COMPLETE_LAYOUTS.find((layout) => layout === value) ?? 'stacked'

export function SwitchCompletePage({
  migrationId,
  organizationId,
  organizationSlug,
}: {
  migrationId: string
  organizationId: string
  organizationSlug: string
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const report = useMigrationSwitch(migrationId)
  const mapping = useIdMapping(migrationId, organizationId)

  const setView = (view: 'switch' | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (view) params.set('view', view)
    else params.delete('view')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  if (searchParams.get('view') === 'switch') {
    return (
      <Box flexDirection="column" rowGap="l">
        <Box
          alignItems="center"
          columnGap="xs"
          color={{ base: 'text-secondary', hover: 'text-primary' }}
          cursor={{ hover: 'pointer' }}
          onClick={() => setView(null)}
        >
          <ChevronLeft size={14} />
          <Text variant="caption" color="inherit">
            Back to summary
          </Text>
        </Box>
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

  const Layout = LAYOUTS[layoutFromParam(searchParams.get('layout'))]
  return (
    <Layout
      report={report.data}
      mapping={mapping.data}
      organizationSlug={organizationSlug}
      onReviewLeftOnStripe={() => setView('switch')}
    />
  )
}
