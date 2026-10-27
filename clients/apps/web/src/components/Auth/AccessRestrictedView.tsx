import AccessRestricted from '@/components/Finance/AccessRestricted'

export default function AccessRestrictedView({
  message,
  standalone,
}: {
  message: string
  standalone: boolean
}) {
  if (!standalone) {
    return <AccessRestricted message={message} />
  }

  return (
    <div className="flex h-full w-full">
      <div className="dark:bg-polar-900 dark:border-polar-800 relative flex min-w-0 flex-2 flex-col items-center rounded-2xl border-gray-200 bg-white px-4 md:overflow-y-auto md:border md:px-8 md:shadow-xs">
        <div className="h-full w-full max-w-(--breakpoint-xl) p-8">
          <AccessRestricted message={message} />
        </div>
      </div>
    </div>
  )
}
