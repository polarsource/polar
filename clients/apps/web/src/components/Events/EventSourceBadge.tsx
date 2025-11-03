import { schemas } from '@polar-sh/client'
import { twMerge } from 'tailwind-merge'

const getEventSourceStyle = (source: schemas['Event']['source']) => {
  switch (source) {
    case 'system':
      return 'text-indigo-500 dark:bg-indigo-950 dark:text-indigo-500'
    case 'user':
      return 'text-amber-500 dark:bg-amber-950 dark:text-amber-500'
    default:
      return ''
  }
}

export const EventSourceBadge = ({
  source,
}: {
  source: schemas['Event']['source']
}) => {
  return (
    <div
      className={twMerge(
        'text-xxs! rounded-sm bg-indigo-50 px-2 py-1 font-mono capitalize',
        getEventSourceStyle(source),
      )}
    >
      {source}
    </div>
  )
}
