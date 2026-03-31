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

const BUILT_IN_NAMES: Record<string, string> = {
  subscriptions: 'Subscriptions',
  cancellations: 'Cancellations',
  'net-revenue': 'Net Revenue',
  orders: 'Orders',
  checkouts: 'Checkouts',
  'one-time': 'One-time Purchases',
  costs: 'Costs',
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
        {isCustomDashboard && currentDashboard && (
          <DashboardDotMenu
            organization={organization}
            dashboard={currentDashboard}
            onEdit={showEdit}
          />
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

function DashboardDotMenu({
  organization,
  dashboard,
  onEdit,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  onEdit: () => void
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
