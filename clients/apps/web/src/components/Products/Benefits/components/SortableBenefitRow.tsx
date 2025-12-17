'use client'

import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { GripVertical, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface SortableBenefitRowProps {
  benefit: schemas['Benefit']
  onRemove: () => void
}

export const SortableBenefitRow = ({
  benefit,
  onRemove,
}: SortableBenefitRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: benefit.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-700 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3',
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
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className={twMerge(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
          )}
        >
          {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{benefit.description}</span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            {benefitsDisplayNames[benefit.type]}
          </span>
        </div>
      </div>
      <Button size="icon" variant="secondary" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
