'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { MetricDashboardEditorContent } from '@/components/DashboardOverview/MetricSelectorModal'
import {
  useDeleteMetricDashboard,
  useMetricDashboards,
  useUpdateMetricDashboard,
} from '@/hooks/queries/metrics'
import { getServerURL } from '@/utils/api'
import { METRIC_GROUPS, toISODate } from '@/utils/metrics'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { MetricsHeader } from './MetricsHeader'
import { useMetricsFilters } from './useMetricsFilters'

const BUILT_IN_NAMES: Record<string, string> = {
  revenue: 'Revenue',
  orders: 'Orders',
  subscriptions: 'Subscriptions',
  checkouts: 'Checkouts',
  cancellations: 'Cancellations',
  'unit-economics': 'Unit Economics',
  costs: 'Costs',
  usage: 'Usage',
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DashboardViewHeaderProps {
  organization: schemas['Organization']
  earliestDateISOString: string
}

export function DashboardViewHeader({
  organization,
  earliestDateISOString,
}: DashboardViewHeaderProps) {
  const pathname = usePathname()
  const { data: customDashboards } = useMetricDashboards(organization.id)
  const { isShown: isEditShown, show: showEdit, hide: hideEdit } = useModal()

  const { interval, startDate, endDate, productId } = useMetricsFilters(
    earliestDateISOString,
  )

  const currentSlug = useMemo(() => {
    const parts = pathname.split('/')
    const metricsIndex = parts.indexOf('metrics')
    return metricsIndex !== -1 ? (parts[metricsIndex + 1] ?? null) : null
  }, [pathname])

  const isCustomDashboard = useMemo(
    () => !!currentSlug && UUID_REGEX.test(currentSlug),
    [currentSlug],
  )

  const currentDashboard = useMemo(() => {
    if (!isCustomDashboard || !customDashboards) return null
    return (
      customDashboards.find(
        (d: schemas['MetricDashboardSchema']) => d.id === currentSlug,
      ) ?? null
    )
  }, [isCustomDashboard, currentSlug, customDashboards])

  const dashboardName = useMemo(() => {
    if (!currentSlug) return null
    if (BUILT_IN_NAMES[currentSlug]) return BUILT_IN_NAMES[currentSlug]
    return currentDashboard?.name ?? null
  }, [currentSlug, currentDashboard])

  const metricsForExport = useMemo(() => {
    if (isCustomDashboard && currentDashboard) {
      return currentDashboard.metrics
    }
    if (currentSlug) {
      const group = METRIC_GROUPS.find(
        (g) => g.category.toLowerCase().replace(/\s+/g, '-') === currentSlug,
      )
      return group ? group.metrics.map((m) => m.slug) : []
    }
    return []
  }, [isCustomDashboard, currentDashboard, currentSlug])

  const handleExport = useCallback(() => {
    const url = new URL(`${getServerURL()}/v1/metrics/export`)
    url.searchParams.set('organization_id', organization.id)
    url.searchParams.set('start_date', toISODate(startDate))
    url.searchParams.set('end_date', toISODate(endDate))
    url.searchParams.set('interval', interval)
    url.searchParams.set(
      'timezone',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    productId?.forEach((id) => url.searchParams.append('product_id', id))
    metricsForExport.forEach((m) => url.searchParams.append('metrics', m))
    window.open(url.toString(), '_blank')
  }, [
    organization.id,
    startDate,
    endDate,
    interval,
    productId,
    metricsForExport,
  ])

  return (
    <div className="flex w-full items-center justify-between gap-x-4">
      {dashboardName ? (
        <h3 className="text-xl font-medium whitespace-nowrap dark:text-white">
          {dashboardName}
        </h3>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-x-6">
        <MetricsHeader
          organization={organization}
          earliestDateISOString={earliestDateISOString}
        />
        {isCustomDashboard && currentDashboard ? (
          <DashboardDotMenu
            organization={organization}
            dashboard={currentDashboard}
            onEdit={showEdit}
            onExport={handleExport}
          />
        ) : (
          <ExportMenu onExport={handleExport} />
        )}
      </div>
      {currentDashboard && (
        <Modal
          title="Edit Dashboard"
          isShown={isEditShown}
          hide={hideEdit}
          modalContent={
            <EditDashboardContent
              organization={organization}
              dashboard={currentDashboard}
              onClose={hideEdit}
            />
          }
        />
      )}
    </div>
  )
}

// ─── Dot menu ────────────────────────────────────────────────────────────────

function ExportMenu({ onExport }: { onExport: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="secondary" className="h-8 w-8">
          <MoreVertOutlined fontSize="small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExport}>Export</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DashboardDotMenu({
  organization,
  dashboard,
  onEdit,
  onExport,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  onEdit: () => void
  onExport: () => void
}) {
  const router = useRouter()
  const deleteMutation = useDeleteMetricDashboard(dashboard.id, organization.id)
  const {
    isShown: isDeleteShown,
    show: showDelete,
    hide: hideDelete,
  } = useModal()

  const handleDelete = useCallback(async () => {
    await deleteMutation.mutateAsync()
    hideDelete()
    router.push(`/dashboard/${organization.slug}/analytics/metrics`)
  }, [deleteMutation, hideDelete, router, organization.slug])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="secondary" className="h-8 w-8">
            <MoreVertOutlined fontSize="small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}>Export</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={showDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmModal
        isShown={isDeleteShown}
        hide={hideDelete}
        title={`Delete "${dashboard.name}"?`}
        description="This action cannot be undone."
        destructive
        destructiveText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}

// ─── Edit dashboard form ──────────────────────────────────────────────────────

function EditDashboardContent({
  organization,
  dashboard,
  onClose,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  onClose: () => void
}) {
  const updateMutation = useUpdateMetricDashboard(dashboard.id, organization.id)

  const handleSave = useCallback(
    async (metrics: string[], name?: string) => {
      await updateMutation.mutateAsync({ name: name!, metrics })
      onClose()
    },
    [updateMutation, onClose],
  )

  return (
    <MetricDashboardEditorContent
      title="Edit Dashboard"
      showNameField
      initialName={dashboard.name}
      activeMetrics={dashboard.metrics}
      limit={10}
      onSave={handleSave}
      isPending={updateMutation.isPending}
      saveLabel="Save Changes"
    />
  )
}
