import { cn } from '@polar-sh/ui/lib/utils'
import { PropsWithChildren } from 'react'

const DetailRow = ({
  title,
  subtitle,
  emphasis,
  className,
  children,
}: PropsWithChildren<{
  title: string
  subtitle?: string
  emphasis?: boolean
  className?: string
}>) => {
  return (
    <div
      data-testid={`detail-row-${title}`}
      className={cn(
        'flex flex-row items-start justify-between gap-x-8',
        emphasis ? 'font-medium' : 'dark:text-polar-500 text-gray-500',
        className,
      )}
    >
      <span className="min-w-0 truncate">
        {title}
        {subtitle && (
          <span className="dark:text-polar-500 ml-1 text-gray-400">
            {subtitle}
          </span>
        )}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

export default DetailRow
