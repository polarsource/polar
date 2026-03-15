'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useDraggable } from '@/hooks/draggable'
import {
  useDeleteMetricDashboard,
  useMetricDashboards,
  useMetricDefinitions,
  useUpdateMetricDashboard,
} from '@/hooks/queries/metrics'
import { ALL_METRICS } from '@/utils/metrics'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DragHandleOutlined from '@mui/icons-material/DragHandleOutlined'
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
import Input from '@polar-sh/ui/components/atoms/Input'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
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

interface MetricItem {
  id: string
  slug: string
  display_name: string
}

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
        <InlineModal
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

// ─── Sortable metric row ──────────────────────────────────────────────────────

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
  const { data: definitions } = useMetricDefinitions(organization.id)

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

  const [selected, setSelected] = useState<MetricItem[]>(() =>
    dashboard.metrics.map((slug: string) => ({
      id: slug,
      slug,
      display_name: slug,
    })),
  )

  // Resolve display names once allMetrics is loaded
  const resolvedSelected = useMemo(
    () =>
      selected.map((s) => {
        const found = allMetrics.find((m) => m.slug === s.slug)
        return found ?? s
      }),
    [selected, allMetrics],
  )

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(resolvedSelected, setSelected, () => {})

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
  } = useForm<{ name: string }>({
    defaultValues: { name: dashboard.name },
  })

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      await updateMutation.mutateAsync({
        name: data.name,
        metrics: selected.map((m) => m.slug),
      })
      onClose()
    },
    [updateMutation, selected, onClose],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <InlineModalHeader hide={onClose}>
        <span>Edit Dashboard</span>
      </InlineModalHeader>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-y-6 px-8 pb-8"
      >
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
            <span className="text-sm text-red-500">{errors.name.message}</span>
          )}
        </div>

        {/* Metrics */}
        <div className="flex flex-col gap-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Metrics
            </label>
            {resolvedSelected.length > 0 && (
              <span className="dark:text-polar-400 text-xs text-gray-500">
                {resolvedSelected.length} selected
              </span>
            )}
          </div>

          {resolvedSelected.length > 0 && (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={resolvedSelected.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-y-1.5">
                  {resolvedSelected.map((item) => (
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

          <div className="dark:border-polar-700 flex max-h-52 flex-col overflow-y-auto rounded-lg border border-gray-200">
            {available.length > 0 ? (
              available.map((metric) => (
                <button
                  key={metric.slug}
                  type="button"
                  onClick={() => handleAdd(metric)}
                  className="dark:hover:bg-polar-800 dark:text-polar-200 flex items-center justify-between px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <span>{metric.display_name}</span>
                </button>
              ))
            ) : (
              <p className="dark:text-polar-400 px-3 py-3 text-center text-sm text-gray-500">
                All metrics selected
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          loading={updateMutation.isPending}
          className="self-start"
        >
          Save Changes
        </Button>
      </form>
    </div>
  )
}
