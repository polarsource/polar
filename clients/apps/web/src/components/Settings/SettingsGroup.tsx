import { twMerge } from 'tailwind-merge'

export const SettingsGroup: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="dark:ring-polar-700 dark:bg-polar-900 dark:divide-polar-700 w-full flex-col divide-y divide-gray-200 overflow-hidden rounded-2xl bg-transparent ring-1 ring-gray-200 dark:ring-1">
    {children}
  </div>
)

export interface SettingsGroupItemProps {
  title: string
  description?: string
  vertical?: boolean
}

export const SettingsGroupItem: React.FC<
  React.PropsWithChildren<SettingsGroupItemProps>
> = ({ children, title, description, vertical }) => (
  <div
    className={twMerge(
      'flex gap-x-12 gap-y-4 p-4',
      vertical
        ? 'flex-col'
        : 'flex-col md:flex-row md:items-start md:justify-between',
    )}
  >
    <div className="flex w-full flex-col md:max-w-1/2">
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="dark:text-polar-500 text-xs text-gray-500">
          {description}
        </p>
      )}
    </div>
    {children && (
      <div
        className={twMerge(
          'flex w-full flex-row gap-y-2 md:w-full',
          vertical ? '' : 'md:justify-end',
        )}
      >
        {children}
      </div>
    )}
  </div>
)

export const SettingsGroupActions: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
    {children}
  </div>
)
