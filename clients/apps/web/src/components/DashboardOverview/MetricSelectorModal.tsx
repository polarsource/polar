'use client'

import { useModal } from '@/components/Modal/useModal'
import { useDraggable } from '@/hooks/draggable'
import { useUpdateOrganization } from '@/hooks/queries/org'
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
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricItem {
  id: string
  slug: keyof schemas['Metrics']
  display_name: string
}

interface SortableMetricRowProps {
  item: MetricItem
  onRemove: () => void
}

const SortableMetricRow = ({ item, onRemove }: SortableMetricRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex h-12 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4',
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

interface MetricSelectorModalContentProps {
  organization: schemas['Organization']
  activeMetrics: (keyof schemas['Metrics'])[]
  onSave: (slugs: (keyof schemas['Metrics'])[]) => void
}

const toItem = (slug: keyof schemas['Metrics']): MetricItem => ({
  id: slug as string,
  slug,
  display_name:
    ALL_METRICS.find((m) => m.slug === slug)?.display_name ?? String(slug),
})

export const MetricSelectorModalContent = ({
  organization,
  activeMetrics,
  onSave,
}: MetricSelectorModalContentProps) => {
  const [selected, setSelected] = useState<MetricItem[]>(
    activeMetrics.map(toItem),
  )

  const updateOrganization = useUpdateOrganization()

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(selected, setSelected, () => {})

  const handleRemove = useCallback((slug: keyof schemas['Metrics']) => {
    setSelected((prev) => prev.filter((m) => m.slug !== slug))
  }, [])

  const handleAdd = useCallback(
    (slug: keyof schemas['Metrics']) => {
      if (selected.length >= 5) return
      setSelected((prev) => [...prev, toItem(slug)])
    },
    [selected.length],
  )

  const available = ALL_METRICS.filter(
    (m) => !selected.some((s) => s.slug === m.slug),
  )

  const canSave = selected.length === 5

  const handleSave = async () => {
    if (!canSave) return
    const slugs = selected.map((m) => m.slug)
    const result = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: {
          ...organization.feature_settings!,
          overview_metrics: slugs as string[],
        },
      },
    })
    if (!result.error) {
      onSave(slugs)
    }
  }

  const dragOverlayItem = activeId
    ? selected.find((m) => m.id === activeId)
    : null

  return (
    <div className="flex flex-col">
      <div className="dark:divide-polar-700 grid grid-cols-2 divide-x divide-gray-100">
        {/* Left panel — selected metrics */}
        <div className="flex flex-col gap-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Selected
            </h3>
            <span
              className={twMerge(
                'text-xs',
                selected.length === 5
                  ? 'text-green-600 dark:text-green-400'
                  : 'dark:text-polar-400 text-gray-500',
              )}
            >
              {selected.length}/5
            </span>
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
              <div className="flex flex-col gap-y-2">
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
                <div className="dark:bg-polar-800 dark:border-polar-700 flex h-12 w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 shadow-lg">
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
        <div className="flex flex-col gap-y-4 p-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Available
          </h3>
          <div className="flex max-h-80 flex-col gap-y-1 overflow-y-auto">
            {available.map((metric) => (
              <button
                key={metric.slug as string}
                type="button"
                disabled={selected.length >= 5}
                onClick={() => handleAdd(metric.slug)}
                className={twMerge(
                  'dark:hover:bg-polar-700 cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                  selected.length >= 5
                    ? 'dark:text-polar-500 cursor-not-allowed text-gray-500'
                    : null,
                )}
              >
                {metric.display_name}
              </button>
            ))}
            {available.length === 0 && (
              <p className="dark:text-polar-400 text-center text-sm text-gray-500">
                All metrics selected
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="dark:border-polar-700 flex items-center justify-end gap-x-2 border-t border-gray-100 px-6 py-4">
        <Button
          disabled={!canSave || updateOrganization.isPending}
          loading={updateOrganization.isPending}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export const useMetricSelectorModal = () => useModal()
