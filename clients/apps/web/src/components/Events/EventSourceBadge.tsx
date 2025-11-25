import { schemas } from '@polar-sh/client'
import { twMerge } from 'tailwind-merge'

const getEventSourceStyle = (source: schemas['Event']['source']) => {
  switch (source) {
    case 'system':
      return 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-500'
    case 'user':
      return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-500'
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
        'text-xxs! rounded-sm px-2 py-1 font-mono capitalize',
        getEventSourceStyle(source),
      )}
    >
      {source}
    </div>
  )
}
