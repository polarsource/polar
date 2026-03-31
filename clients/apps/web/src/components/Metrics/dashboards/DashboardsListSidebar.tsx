'use client'

import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { MetricDashboardEditorContent } from '@/components/DashboardOverview/MetricSelectorModal'
import {
  useCreateMetricDashboard,
  useMetricDashboards,
} from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import AddOutlined from '@mui/icons-material/AddOutlined'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { MetricType } from './metrics-config'

interface DefaultDashboard {
  slug: MetricType
  title: string
}

interface DashboardsListSidebarProps {
  organization: schemas['Organization']
  defaultDashboards: DefaultDashboard[]
}

export function DashboardsListSidebar({
  organization,
  defaultDashboards,
}: DashboardsListSidebarProps) {
  const { data: customDashboards } = useMetricDashboards(organization.id)
  const {
    isShown: isDashboardShown,
    show: showDashboard,
    hide: hideDashboard,
  } = useModal()
  const pathname = usePathname()
  const basePath = `/dashboard/${organization.slug}/analytics/metrics`

  const selectedSlug = useMemo(() => {
    const parts = pathname.split('/')
    const metricsIndex = parts.indexOf('metrics')
    return metricsIndex !== -1 ? (parts[metricsIndex + 1] ?? null) : null
  }, [pathname])

  return (
    <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
      <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
        <span className="font-medium text-gray-900 dark:text-white">
          Dashboards
        </span>
        <Button size="icon" className="h-6 w-6" onClick={showDashboard}>
          <AddOutlined fontSize="small" />
        </Button>
      </div>

      <div className="dark:divide-polar-800 flex grow flex-col divide-y divide-gray-50 overflow-y-auto">
        {defaultDashboards.map((dashboard) => (
          <Link
            key={dashboard.slug}
            href={`${basePath}/${dashboard.slug}`}
            className={twMerge(
              'dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-y-0.5 px-4 py-3 hover:bg-gray-100',
              selectedSlug === dashboard.slug &&
                'dark:bg-polar-800 bg-gray-100',
            )}
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {dashboard.title}
            </span>
          </Link>
        ))}

        {customDashboards && customDashboards.length > 0 && (
          <>
            {customDashboards.map(
              (dashboard: schemas['MetricDashboardSchema']) => (
                <Link
                  key={dashboard.id}
                  href={`${basePath}/${dashboard.id}`}
                  className={twMerge(
                    'dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-y-0.5 px-4 py-3 hover:bg-gray-100',
                    selectedSlug === dashboard.id &&
                      'dark:bg-polar-800 bg-gray-100',
                  )}
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {dashboard.name}
                  </span>
                  <span className="dark:text-polar-400 text-xs text-gray-500">
                    {dashboard.metrics.length === 0
                      ? 'No metrics'
                      : `${dashboard.metrics.length} metric${dashboard.metrics.length === 1 ? '' : 's'}`}
                  </span>
                </Link>
              ),
            )}
          </>
        )}
      </div>

      <Modal
        title="Create Dashboard"
        isShown={isDashboardShown}
        hide={hideDashboard}
        modalContent={
          <CreateDashboardContent
            organization={organization}
            onClose={hideDashboard}
          />
        }
      />
    </div>
  )
}

function CreateDashboardContent({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) {
  const router = useRouter()
  const createMutation = useCreateMetricDashboard(organization.id)

  const handleSave = useCallback(
    async (metrics: string[], name?: string) => {
      const result = await createMutation.mutateAsync({
        name: name!,
        metrics,
        organization_id: organization.id,
      })
      if (!result.error && result.data) {
        onClose()
        router.push(
          `/dashboard/${organization.slug}/analytics/metrics/${result.data.id}`,
        )
      }
    },
    [createMutation, organization, onClose, router],
  )

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
