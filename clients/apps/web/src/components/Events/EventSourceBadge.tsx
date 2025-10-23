import { schemas } from '@polar-sh/client'

export const EventSourceBadge = ({
  source,
}: {
  source: schemas['Event']['source']
}) => {
  if (source === 'user') return null

  return (
    <div className="rounded-sm bg-indigo-50 px-2 py-1 font-mono text-xs text-indigo-500 capitalize dark:bg-indigo-950 dark:text-indigo-500">
      {source}
    </div>
  )
}
