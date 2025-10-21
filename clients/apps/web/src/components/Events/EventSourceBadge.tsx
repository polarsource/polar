import { schemas } from '@polar-sh/client'

export const EventSourceBadge = ({
  source,
}: {
  source: schemas['Event']['source']
}) => {
  if (source === 'user') return null

  return (
    <div className="rounded-sm bg-indigo-100 px-2 py-1 font-mono text-xs capitalize text-indigo-500 dark:bg-indigo-950 dark:text-indigo-500">
      {source}
    </div>
  )
}
