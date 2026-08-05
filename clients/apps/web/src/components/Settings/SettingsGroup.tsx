import { twMerge } from 'tailwind-merge'

export const SettingsGroup: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="dark:ring-polar-700 dark:bg-polar-900 dark:divide-polar-700 w-full flex-col divide-y divide-gray-200 overflow-hidden rounded-2xl bg-transparent ring-1 ring-gray-200 dark:ring-1">
    {children}
  </div>
)

const layouts = {
  split: {
    row: 'flex-col gap-x-12 md:flex-row md:items-start md:justify-between',
    label: 'w-full md:max-w-1/2',
    control: 'w-full md:justify-end',
  },
  stacked: {
    row: 'flex-col gap-x-12',
    label: 'w-full md:max-w-1/2',
    control: 'w-full',
  },
  inline: {
    row: 'flex-row items-start justify-between gap-x-4 md:gap-x-12',
    label: 'min-w-0 flex-1 md:max-w-1/2',
    control: 'shrink-0 justify-end',
  },
} as const

export interface SettingsGroupItemProps {
  title: React.ReactNode
  description?: React.ReactNode
  layout?: keyof typeof layouts
}

export const SettingsGroupItem: React.FC<
  React.PropsWithChildren<SettingsGroupItemProps>
> = ({ children, title, description, layout = 'split' }) => {
  const { row, label, control } = layouts[layout]

  return (
    <div className={twMerge('flex gap-y-4 p-4', row)}>
      <div className={twMerge('flex flex-col', label)}>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className={twMerge('flex flex-row gap-y-2', control)}>
          {children}
        </div>
      )}
    </div>
  )
}
