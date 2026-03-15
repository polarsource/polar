'use client'

import MeterSelector from '@/components/Meter/MeterSelector'
import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useDraggable } from '@/hooks/draggable'
import {
  useCreateMetricDashboard,
  useCreateMetricDefinition,
  useMetricDashboards,
  useMetricDefinitions,
} from '@/hooks/queries/metrics'
import { ALL_METRICS } from '@/utils/metrics'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DragHandleOutlined from '@mui/icons-material/DragHandleOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import Input from '@polar-sh/ui/components/atoms/Input'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
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
  const {
    isShown: isMetricShown,
    show: showMetric,
    hide: hideMetric,
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-6 w-6">
              <AddOutlined fontSize="small" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={showDashboard}>
              New Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={showMetric}>New Metric</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <div className="dark:text-polar-400 px-4 py-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
              Custom
            </div>
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

      <InlineModal
        isShown={isDashboardShown}
        hide={hideDashboard}
        modalContent={
          <CreateDashboardContent
            organization={organization}
            onClose={hideDashboard}
          />
        }
      />
      <InlineModal
        isShown={isMetricShown}
        hide={hideMetric}
        modalContent={
          <CreateMetricContent
            organization={organization}
            onClose={hideMetric}
          />
        }
      />
    </div>
  )
}

// ─── Metric item type ────────────────────────────────────────────────────────

interface MetricItem {
  id: string
  slug: string
  display_name: string
}

// ─── Sortable row ────────────────────────────────────────────────────────────

function SortableMetricRow({
  item,
  onRemove,
}: {
  item: MetricItem
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="dark:text-polar-500 dark:hover:text-polar-300 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DragHandleOutlined fontSize="small" />
        </button>
        <span className="text-sm">{item.display_name}</span>
      </div>
      <Button
        size="icon"
        className="h-5 w-5"
        variant="ghost"
        onClick={onRemove}
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

// ─── Create dashboard form ───────────────────────────────────────────────────

function CreateDashboardContent({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) {
  const router = useRouter()
  const createMutation = useCreateMetricDashboard(organization.id)
  const { data: definitions } = useMetricDefinitions(organization.id)
  const [selected, setSelected] = useState<MetricItem[]>([])

  const allMetrics = useMemo<MetricItem[]>(() => {
    const builtIn = ALL_METRICS.map((m) => ({
      id: m.slug as string,
      slug: m.slug as string,
      display_name: m.display_name,
    }))
    const custom = (definitions ?? []).map(
      (d: schemas['MetricDefinitionSchema']) => ({
        id: d.slug,
        slug: d.slug,
        display_name: d.name,
      }),
    )
    return [...builtIn, ...custom]
  }, [definitions])

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(selected, setSelected, () => {})

  const available = useMemo(
    () => allMetrics.filter((m) => !selected.some((s) => s.slug === m.slug)),
    [allMetrics, selected],
  )

  const handleAdd = useCallback((item: MetricItem) => {
    setSelected((prev) => [...prev, item])
  }, [])

  const handleRemove = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((m) => m.slug !== slug))
  }, [])

  const dragOverlayItem = activeId
    ? selected.find((m) => m.id === activeId)
    : null

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>()

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      const result = await createMutation.mutateAsync({
        name: data.name,
        metrics: selected.map((m) => m.slug),
        organization_id: organization.id,
      })

      if (!result.error && result.data) {
        onClose()
        router.push(
          `/dashboard/${organization.slug}/analytics/metrics/${result.data.id}`,
        )
      }
    },
    [
      createMutation,
      selected,
      organization.id,
      organization.slug,
      onClose,
      router,
    ],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <InlineModalHeader hide={onClose}>
        <span>Create Dashboard</span>
      </InlineModalHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        <div className="flex flex-col gap-y-6 px-8 pb-6">
          {/* Name */}
          <div className="flex flex-col gap-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Name
            </label>
            <Input
              {...register('name', { required: 'Name is required' })}
              placeholder="e.g. Revenue Overview"
            />
            {errors.name && (
              <span className="text-sm text-red-500">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Metrics
              </label>
              {selected.length > 0 && (
                <span className="dark:text-polar-400 text-xs text-gray-500">
                  {selected.length} selected
                </span>
              )}
            </div>

            {/* Selected — draggable */}
            {selected.length > 0 && (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={selected.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-y-1.5">
                    {selected.map((item) => (
                      <SortableMetricRow
                        key={item.id}
                        item={item}
                        onRemove={() => handleRemove(item.slug)}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {dragOverlayItem && (
                    <div className="dark:bg-polar-800 dark:border-polar-700 flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 shadow-lg">
                      <DragHandleOutlined
                        fontSize="small"
                        className="dark:text-polar-500 text-gray-400"
                      />
                      <span className="text-sm">
                        {dragOverlayItem.display_name}
                      </span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}

            {/* Available — flat list */}
            {available.length > 0 ? (
              <div className="flex flex-col">
                {available.map((metric) => (
                  <button
                    key={metric.slug}
                    type="button"
                    onClick={() => handleAdd(metric)}
                    className="dark:hover:bg-polar-800 dark:text-polar-200 flex items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <span>{metric.display_name}</span>
                    <AddOutlined
                      fontSize="inherit"
                      className="dark:text-polar-500 text-gray-400"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="dark:text-polar-400 py-2 text-center text-sm text-gray-500">
                All metrics selected
              </p>
            )}
          </div>
        </div>

        <div className="dark:bg-polar-900 dark:border-polar-800 sticky bottom-0 border-t border-gray-100 bg-white px-8 py-6">
          <Button type="submit" loading={createMutation.isPending}>
            Create Dashboard
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Create metric form ───────────────────────────────────────────────────────

function CreateMetricContent({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) {
  const createMutation = useCreateMetricDefinition(organization.id)
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; slug: string }>()

  const onSubmit = useCallback(
    async (data: { name: string; slug: string }) => {
      if (!selectedMeterId) return

      const result = await createMutation.mutateAsync({
        name: data.name,
        slug: data.slug,
        meter_id: selectedMeterId,
        organization_id: organization.id,
      })

      if (!result.error) {
        onClose()
      }
    },
    [createMutation, selectedMeterId, organization.id, onClose],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <InlineModalHeader hide={onClose}>
        <span>Create Metric</span>
      </InlineModalHeader>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-y-6 px-8 pb-8"
      >
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Name
          </label>
          <Input
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g. API Calls"
          />
          {errors.name && (
            <span className="text-sm text-red-500">{errors.name.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Slug
          </label>
          <Input
            {...register('slug', {
              required: 'Slug is required',
              pattern: {
                value: /^[a-z0-9_]+$/,
                message:
                  'Only lowercase letters, numbers, and underscores allowed',
              },
            })}
            placeholder="e.g. api_calls"
          />
          {errors.slug && (
            <span className="text-sm text-red-500">{errors.slug.message}</span>
          )}
          <p className="dark:text-polar-400 text-xs text-gray-500">
            Unique identifier used in API queries.
          </p>
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Meter
          </label>
          <MeterSelector
            organizationId={organization.id}
            value={selectedMeterId}
            onChange={setSelectedMeterId}
            placeholder="Select a meter"
          />
        </div>

        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={!selectedMeterId}
          className="self-start"
        >
          Create Metric
        </Button>
      </form>
    </div>
  )
}
