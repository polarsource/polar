'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { MetricDashboardEditorContent } from '@/components/DashboardOverview/MetricSelectorModal'
import {
  useCreateMetricDashboard,
  useDeleteMetricDashboard,
  useUpdateMetricDashboard,
} from '@/hooks/queries/metrics'
import { useHasPermission } from '@/hooks/permissions'
import { getServerURL } from '@/utils/api'
import { permissionDeniedMessage } from '@/utils/permissions'
import { ALL_METRICS, toISODate } from '@/utils/metrics'
import { AddOutlined, MoreVertOutlined } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { useMetricsFilters } from './useMetricsFilters'

const ALL_METRIC_SLUGS = ALL_METRICS.map((m) => m.slug)

function useMetricsExport(
  organization: schemas['Organization'],
  earliestDateISOString: string,
) {
  const { interval, startDate, endDate, productId } = useMetricsFilters(
    earliestDateISOString,
  )

  return useCallback(
    (metrics: string[]) => {
      const url = new URL(
        `${getServerURL()}/v1/metrics/export`,
        window.location.origin,
      )
      url.searchParams.set('organization_id', organization.id)
      url.searchParams.set('start_date', toISODate(startDate))
      url.searchParams.set('end_date', toISODate(endDate))
      url.searchParams.set('interval', interval)
      url.searchParams.set(
        'timezone',
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      )
      productId?.forEach((id) => url.searchParams.append('product_id', id))
      metrics.forEach((m) => url.searchParams.append('metrics', m))
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
    },
    [organization.id, startDate, endDate, interval, productId],
  )
}

interface DashboardViewActionsProps {
  organization: schemas['Organization']
  earliestDateISOString: string
  className?: string
}

export function DashboardViewActions({
  organization,
  earliestDateISOString,
  className,
}: DashboardViewActionsProps) {
  const {
    isShown: isCreateShown,
    show: showCreate,
    hide: hideCreate,
  } = useModal()
  const exportMetrics = useMetricsExport(organization, earliestDateISOString)

  return (
    <div className={twMerge('flex items-center gap-x-2', className)}>
      <Button
        size="icon"
        variant="secondary"
        className="h-8 w-8"
        onClick={showCreate}
      >
        <AddOutlined fontSize="small" />
      </Button>
      <ExportMenu onExport={() => exportMetrics(ALL_METRIC_SLUGS)} />
      <Modal
        title="Create Dashboard"
        isShown={isCreateShown}
        hide={hideCreate}
        modalContent={
          <CreateDashboardContent
            organization={organization}
            onClose={hideCreate}
          />
        }
      />
    </div>
  )
}

export function CustomDashboardActions({
  organization,
  dashboard,
  earliestDateISOString,
}: {
  organization: schemas['Organization']
  dashboard: schemas['MetricDashboardSchema']
  earliestDateISOString: string
}) {
  const { isShown: isEditShown, show: showEdit, hide: hideEdit } = useModal()
  const exportMetrics = useMetricsExport(organization, earliestDateISOString)

  return (
    <>
      <DashboardDotMenu
        organization={organization}
        dashboard={dashboard}
        onEdit={showEdit}
        onExport={() => exportMetrics(dashboard.metrics)}
      />
      <Modal
        title="Edit Dashboard"
        isShown={isEditShown}
        hide={hideEdit}
        modalContent={
          <EditDashboardContent
            organization={organization}
            dashboard={dashboard}
            onClose={hideEdit}
          />
        }
      />
    </>
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
  const canManageAnalytics = useHasPermission(
    organization.id,
    'analytics:manage',
  )
  const deleteMutation = useDeleteMetricDashboard(dashboard.id, organization.id)
  const {
    isShown: isDeleteShown,
    show: showDelete,
    hide: hideDelete,
  } = useModal()

  const handleDelete = useCallback(async () => {
    await deleteMutation.mutateAsync()
    hideDelete()
  }, [deleteMutation, hideDelete])

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
          <DropdownMenuItem
            destructive
            onClick={() => {
              if (!canManageAnalytics) {
                toast({
                  title: 'Restricted access',
                  description: permissionDeniedMessage('analytics:manage'),
                })
                return
              }

              showDelete()
            }}
          >
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
  const canManageAnalytics = useHasPermission(
    organization.id,
    'analytics:manage',
  )
  const updateMutation = useUpdateMetricDashboard(dashboard.id, organization.id)

  const handleSave = useCallback(
    async (metrics: string[], name?: string) => {
      await updateMutation.mutateAsync({ name: name!, metrics })
      onClose()
    },
    [updateMutation, onClose],
  )

  if (!canManageAnalytics) {
    return (
      <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
        <AccessRestricted
          message={permissionDeniedMessage('analytics:manage')}
        />
      </Box>
    )
  }

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

function CreateDashboardContent({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) {
  const canManageAnalytics = useHasPermission(
    organization.id,
    'analytics:manage',
  )
  const createMutation = useCreateMetricDashboard(organization.id)

  const handleSave = useCallback(
    async (metrics: string[], name?: string) => {
      const result = await createMutation.mutateAsync({
        name: name!,
        metrics,
        organization_id: organization.id,
      })
      if (result.error) {
        toast({
          title: 'Could not create dashboard',
          description: 'Please try again.',
        })
        return
      }
      onClose()
    },
    [createMutation, organization.id, onClose],
  )

  if (!canManageAnalytics) {
    return (
      <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
        <AccessRestricted
          message={permissionDeniedMessage('analytics:manage')}
        />
      </Box>
    )
  }

  return (
    <MetricDashboardEditorContent
      title="Create Dashboard"
      showNameField
      activeMetrics={[]}
      limit={10}
      onSave={handleSave}
      isPending={createMutation.isPending}
      saveLabel="Create Dashboard"
    />
  )
}
