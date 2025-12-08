import { CornerDownLeft } from 'lucide-react'

interface Props {
  icon?: React.ReactNode
  title: string
  description?: string
}

export const Result = ({ icon, title, description }: Props) => {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-3">
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex flex-row items-center gap-2">
          {icon && (
            <span className="flex h-5 w-5 items-center justify-center text-gray-500 dark:text-gray-400">
              {icon}
            </span>
          )}
          <div className="font-medium text-black dark:text-white">{title}</div>
        </div>
        {description && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </div>
        )}
      </div>
      <div className="dark:bg-polar-700 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-200 px-1.5 py-0.5 opacity-0 group-data-[selected='true']:opacity-100">
        <CornerDownLeft className="text-gray-500 dark:text-gray-400" />
      </div>
    </div>
  )
}
