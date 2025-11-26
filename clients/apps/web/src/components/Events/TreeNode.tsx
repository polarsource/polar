import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface TreeNodeProps {
  event: schemas['Event']
  organization: schemas['Organization']
  depth?: number
  childEvents?: schemas['Event'][]
  onEventClick: (eventId: string) => void
}

export const TreeNode = ({
  event,
  organization,
  depth = 0,
  childEvents = [],
  onEventClick,
}: TreeNodeProps) => {
  const searchParams = useSearchParams()
  const currentEventId = searchParams.get('event')
  const isSelected = currentEventId === event.id

  const formattedTimestamp = useMemo(
    () =>
      new Date(event.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [event.timestamp],
  )

  const costDisplay = useMemo(() => {
    if ('_cost' in event.metadata && event.metadata._cost) {
      return formatSubCentCurrency(Number(event.metadata._cost?.amount ?? 0))
    }
    return null
  }, [event.metadata])

  const showEventType = event.label !== event.name
  const showBorder = depth > 0

  return (
    <div className="flex flex-col">
      <div
        className={twMerge(
          showBorder &&
            'dark:border-polar-700 ml-4 border-l border-gray-200 py-1 pl-2',
        )}
      >
        <div
          className={twMerge(
            'dark:hover:bg-polar-800 group flex cursor-pointer flex-col gap-y-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-gray-50',
            isSelected && 'dark:bg-polar-800 bg-gray-100',
          )}
          onClick={() => onEventClick(event.id)}
        >
          <div className="flex flex-col gap-y-1">
            {showEventType && (
              <span className="dark:text-polar-500 block text-xs text-gray-500">
                {event.name}
              </span>
            )}
            <span className="text-sm font-medium">{event.label}</span>
          </div>
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
              {formattedTimestamp}
            </span>
            {costDisplay && (
              <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
                {costDisplay}
              </span>
            )}
          </div>
        </div>
      </div>
      {childEvents.length > 0 && (
        <div className="mt-2 flex flex-col">
          {childEvents.map((child) => (
            <TreeNode
              key={child.id}
              event={child}
              organization={organization}
              depth={depth + 1}
              childEvents={[]}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
