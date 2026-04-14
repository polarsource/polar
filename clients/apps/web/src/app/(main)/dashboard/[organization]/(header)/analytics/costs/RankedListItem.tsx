'use client'

import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { ReactNode } from 'react'

interface RankedListItemProps {
  itemKey: string
  rank: number
  label: ReactNode
  stats: ReactNode
  share: number
  onSelect?: () => void
}

export const RankedListItem = ({
  itemKey,
  rank,
  label,
  stats,
  share,
  onSelect,
}: RankedListItemProps) => {
  const sharePct = Math.round(share * 100)
  return (
    <ListItem
      key={itemKey}
      className="flex-col items-stretch gap-3 py-4"
      onSelect={onSelect}
    >
      <div className="flex items-center gap-4">
        <span className="dark:text-polar-500 shrink-0 text-xs text-gray-400 tabular-nums">
          {rank}
        </span>
        {label}
        <div className="flex shrink-0 items-center gap-3">{stats}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="dark:bg-polar-700 relative h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-black transition-all dark:bg-white"
            style={{ width: `${sharePct}%` }}
          />
        </div>
        <span className="dark:text-polar-500 w-9 shrink-0 text-right text-xs text-gray-400 tabular-nums">
          {sharePct}%
        </span>
      </div>
    </ListItem>
  )
}

interface RankedListProps {
  children: ReactNode
}

export const RankedList = ({ children }: RankedListProps) => (
  <List size="small">{children}</List>
)
