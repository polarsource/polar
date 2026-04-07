'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useDraggable } from '@/hooks/draggable'
import { useUpdateOrganization } from '@/hooks/queries/org'
import { ALL_METRICS, METRIC_GROUPS } from '@/utils/metrics'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DragHandleOutlined from '@mui/icons-material/DragHandleOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

interface MetricItem {
  id: string
  slug: string
  display_name: string
}

const toItem = (slug: string): MetricItem => ({
  id: slug,
  slug,
  display_name: ALL_METRICS.find((m) => m.slug === slug)?.display_name ?? slug,
})

// ─── Sortable row ─────────────────────────────────────────────────────────────

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
        'dark:bg-polar-800 flex w-full items-center justify-between rounded-lg bg-gray-100 px-4 py-2',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="dark:text-polar-500 dark:hover:text-polar-300 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DragHandleOutlined fontSize="inherit" />
        </button>
        <span className="text-sm font-medium">{item.display_name}</span>
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

// ─── General-purpose dashboard editor ────────────────────────────────────────

export interface MetricDashboardEditorContentProps {
  title: string
  /** When provided, renders an InlineModalHeader. Omit when wrapped by Modal. */
  onClose?: () => void
  initialName?: string
  showNameField?: boolean
  activeMetrics: string[]
  /** Maximum number of selectable metrics. Omit for no limit. */
  limit?: number
  onSave: (metrics: string[], name?: string) => Promise<void>
  isPending: boolean
  saveLabel?: string
}

export const MetricDashboardEditorContent = ({
  title,
  onClose,
  initialName,
  showNameField,
  activeMetrics,
  limit,
  onSave,
  isPending,
  saveLabel = 'Save',
}: MetricDashboardEditorContentProps) => {
  const [selected, setSelected] = useState<MetricItem[]>(
    activeMetrics.map(toItem),
  )

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(selected, setSelected, () => {})

  const handleRemove = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((m) => m.slug !== slug))
  }, [])

  const handleAdd = useCallback(
    (slug: string) => {
      if (limit !== undefined && selected.length >= limit) return
      setSelected((prev) => [...prev, toItem(slug)])
    },
    [limit, selected.length],
  )

  const groupedAvailable = useMemo(() => {
    const selectedSlugs = new Set(selected.map((m) => m.slug))
    return METRIC_GROUPS.map((g) => ({
      category: g.category,
      metrics: g.metrics.filter((m) => !selectedSlugs.has(m.slug as string)),
    })).filter((g) => g.metrics.length > 0)
  }, [selected])

  const availableCount = groupedAvailable.reduce(
    (n, g) => n + g.metrics.length,
    0,
  )

  const atLimit = limit !== undefined && selected.length >= limit
  const aboveLimit = limit !== undefined && selected.length > limit
  const dragOverlayItem = activeId
    ? selected.find((m) => m.id === activeId)
    : null

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string }>({
    defaultValues: { name: initialName ?? '' },
  })

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      await onSave(
        selected.map((m) => m.slug),
        showNameField ? data.name : undefined,
      )
    },
    [onSave, selected, showNameField],
  )

  return (
    <div className="flex flex-col">
      {onClose && (
        <InlineModalHeader hide={onClose}>
          <span>{title}</span>
        </InlineModalHeader>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        {showNameField && (
          <div className="flex flex-col gap-y-2 px-5 pt-6">
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
        )}

        <div className="dark:divide-polar-700 grid grid-cols-2 divide-x divide-gray-100 p-6">
          {/* Left panel — selected metrics */}
          <div className="flex flex-col gap-y-4 pr-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Selected
              </h3>
              {limit !== undefined && (
                <span
                  className={twMerge(
                    'text-sm font-medium',
                    atLimit
                      ? 'text-black dark:text-white'
                      : 'dark:text-polar-400 text-gray-500',
                  )}
                >
                  {selected.length}/{limit}
                </span>
              )}
            </div>
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
                <div className="flex max-h-96 flex-col gap-y-2 overflow-y-auto">
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
                  <div className="dark:bg-polar-800 flex h-12 items-center gap-3 rounded-lg bg-white px-4 shadow-xl">
                    <DragHandleOutlined
                      fontSize="inherit"
                      className="text-gray-500 dark:text-gray-500"
                    />
                    <span className="text-sm font-medium">
                      {dragOverlayItem.display_name}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            {selected.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center">
                <p className="dark:text-polar-500 text-center text-sm text-gray-500">
                  Add metrics from the right panel
                </p>
              </div>
            )}
          </div>

          {/* Right panel — available metrics */}
          <div className="flex flex-col gap-y-4 pl-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Metrics
            </h3>
            <div className="flex h-96 flex-col gap-y-2 overflow-y-auto">
              {groupedAvailable.map(({ category, metrics }) => (
                <details key={category} className="group">
                  <summary className="dark:bg-polar-800 flex cursor-pointer list-none items-center justify-between rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium select-none">
                    {category}
                    <svg
                      className="h-3 w-3 transition-transform group-open:rotate-180"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M2 4l4 4 4-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div className="flex flex-col py-2">
                    {metrics.map((metric) => (
                      <button
                        key={metric.slug as string}
                        type="button"
                        disabled={atLimit}
                        onClick={() => handleAdd(metric.slug as string)}
                        className={twMerge(
                          'dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-y-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100',
                          atLimit
                            ? 'dark:text-polar-500 cursor-not-allowed text-gray-500'
                            : null,
                        )}
                      >
                        <span className="text-sm font-medium">
                          {metric.display_name}
                        </span>
                        <span className="dark:text-polar-400 text-xs text-gray-500">
                          {metric.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
              {availableCount === 0 && (
                <p className="dark:text-polar-400 text-center text-sm text-gray-500">
                  All metrics selected
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="dark:border-polar-700 flex items-center justify-end gap-x-2 border-t border-gray-100 px-6 py-4">
          <Button
            type="submit"
            disabled={(limit !== undefined && aboveLimit) || isPending}
            loading={isPending}
          >
            {saveLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Overview wrapper (preserves existing OverviewSection API) ────────────────

interface MetricSelectorModalContentProps {
  organization: schemas['Organization']
  activeMetrics: (keyof schemas['Metrics'])[]
  onSave: (slugs: (keyof schemas['Metrics'])[]) => void
}

export const MetricSelectorModalContent = ({
  organization,
  activeMetrics,
  onSave,
}: MetricSelectorModalContentProps) => {
  const updateOrganization = useUpdateOrganization()

  const handleSave = async (metrics: string[]) => {
    const result = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: {
          ...organization.feature_settings!,
          overview_metrics: metrics,
        },
      },
    })
    if (!result.error) {
      onSave(metrics as (keyof schemas['Metrics'])[])
    }
  }

  return (
    <MetricDashboardEditorContent
      title=""
      activeMetrics={activeMetrics as string[]}
      limit={5}
      isPending={updateOrganization.isPending}
      onSave={handleSave}
    />
  )
}

export const useMetricSelectorModal = () => useModal()
