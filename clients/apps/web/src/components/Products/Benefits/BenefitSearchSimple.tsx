'use client'

import { useDraggable } from '@/hooks/draggable'
import { closestCenter, DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { schemas } from '@polar-sh/client'
import { useCallback, useMemo } from 'react'
import { BenefitRow } from './components/BenefitRow'
import { SortableBenefitRow } from './components/SortableBenefitRow'

interface Props {
  organization: schemas['Organization']
  benefits: schemas['Benefit'][]
  selectedBenefits: schemas['Benefit'][]
  onSelectBenefit: (benefit: schemas['Benefit']) => void
  onRemoveBenefit: (benefit: schemas['Benefit']) => void
  onReorderBenefits?: (benefits: schemas['Benefit'][]) => void
  isReorderMode: boolean
}

export const BenefitSearchSimple = ({
  organization,
  benefits,
  selectedBenefits,
  onSelectBenefit,
  onRemoveBenefit,
  onReorderBenefits,
  isReorderMode,
}: Props) => {
  const selectedBenefitIds = useMemo(
    () => selectedBenefits.map((b) => b.id),
    [selectedBenefits],
  )

  const handleToggle = useCallback(
    (benefit: schemas['Benefit'], checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [onSelectBenefit, onRemoveBenefit],
  )

  const {
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDraggable(
    selectedBenefits,
    (updatedBenefits) => {
      onReorderBenefits?.(updatedBenefits)
    },
    () => {},
  )

  const activeBenefit = useMemo(
    () =>
      activeId ? selectedBenefits.find((b) => b.id === activeId) : undefined,
    [activeId, selectedBenefits],
  )

  if (benefits.length === 0) {
    return (
      <div className="dark:border-polar-700 dark:text-polar-500 rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-500">
        No benefits available
      </div>
    )
  }

  if (isReorderMode) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={selectedBenefits}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {selectedBenefits.map((benefit) => (
              <SortableBenefitRow
                key={benefit.id}
                benefit={benefit}
                onRemove={() => onRemoveBenefit(benefit)}
              />
            ))}
          </div>
          <DragOverlay adjustScale={true}>
            {activeBenefit ? (
              <SortableBenefitRow benefit={activeBenefit} onRemove={() => {}} />
            ) : null}
          </DragOverlay>
        </SortableContext>
      </DndContext>
    )
  }

  return (
    <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
      {benefits.map((benefit) => (
        <BenefitRow
          key={benefit.id}
          organization={organization}
          benefit={benefit}
          selected={selectedBenefitIds.includes(benefit.id)}
          onToggle={handleToggle}
        />
      ))}
    </div>
  )
}
