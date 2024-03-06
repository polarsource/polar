import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { Column } from '@tanstack/react-table'

import { cn } from '@polarkit/lib/utils'
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
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button
        type="button"
        variant="ghost"
        className="p-0"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{title}</span>
        {column.getIsSorted() === 'desc' ? (
          <KeyboardArrowDown className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'asc' ? (
          <KeyboardArrowUp className="ml-2 h-4 w-4" />
        ) : null}
      </Button>
    </div>
  )
}
