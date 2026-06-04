import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import DragHandleOutlined from '@mui/icons-material/DragHandleOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  FormControl,
  FormField,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

interface SortableOptionRowProps {
  id: string
  index: number
  onRemove: () => void
}

const SortableOptionRow: React.FC<SortableOptionRowProps> = ({
  id,
  index,
  onRemove,
}) => {
  const { control } = useFormContext<
    (schemas['CustomFieldCreate'] | schemas['CustomFieldUpdate']) & {
      type: 'select'
    }
  >()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge(
        'flex flex-row items-center gap-2',
        isDragging && 'z-10 opacity-50',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label="Reorder option"
        className="dark:text-polar-500 dark:hover:text-polar-300 flex shrink-0 cursor-grab touch-none items-center justify-center text-gray-400 transition-colors hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DragHandleOutlined fontSize="small" />
      </button>
      <FormField
        control={control}
        name={`properties.options.${index}.value`}
        render={({ field }) => (
          <div className="flex flex-col">
            <FormControl>
              <Input {...field} value={field.value || ''} placeholder="Value" />
            </FormControl>
            <FormMessage />
          </div>
        )}
      />
      <FormField
        control={control}
        name={`properties.options.${index}.label`}
        render={({ field }) => (
          <div className="flex flex-col">
            <FormControl>
              <Input {...field} value={field.value || ''} placeholder="Label" />
            </FormControl>
            <FormMessage />
          </div>
        )}
      />
      <Button
        className={
          'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
        }
        size="icon"
        variant="secondary"
        type="button"
        onClick={onRemove}
      >
        <ClearOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

export default SortableOptionRow
