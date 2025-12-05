import { Column } from '@tanstack/react-table'

import { MoveDown, MoveUp } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import Button from '../Button'

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>
  }

  return (
    <div className={twMerge('flex items-center', className)}>
      <Button
        type="button"
        variant="ghost"
        className="p-0 hover:bg-transparent dark:hover:bg-transparent"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{title}</span>
        {column.getIsSorted() === 'desc' ? (
          <MoveDown className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'asc' ? (
          <MoveUp className="ml-2 h-4 w-4" />
        ) : null}
      </Button>
    </div>
  )
}
