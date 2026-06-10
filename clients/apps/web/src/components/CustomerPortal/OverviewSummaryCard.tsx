import { ReactNode } from 'react'

interface OverviewSummaryCardProps {
  title: string
  meta?: ReactNode
  children: ReactNode
}

export const OverviewSummaryCard = ({
  title,
  meta,
  children,
}: OverviewSummaryCardProps) => {
  return (
    <div className="dark:border-polar-700 flex flex-col gap-4 rounded-3xl border border-gray-200 p-8">
      <div className="items-center justify-between space-y-1.5 sm:flex sm:space-y-0">
        <h4 className="text-lg font-medium">{title}</h4>
        {meta && (
          <span className="dark:text-polar-500 text-sm text-gray-500">
            {meta}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
