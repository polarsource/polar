import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const SettingsCheckbox = ({
  id,
  title,
  isChecked,
  onChange,
  type = 'checkbox',
  description = undefined,
  name = undefined,
  disabled,
}: {
  id: string
  title: string | ReactNode
  description?: string
  name?: string
  type?: 'checkbox' | 'radio'
  isChecked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
}) => {
  name = name || id

  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          name={name}
          type={type}
          onChange={onChange}
          checked={isChecked}
          disabled={!!disabled}
          className={twMerge(
            type === 'radio' ? 'rounded-full' : 'rounded',
            'dark:bg-polar-800 dark:border-polar-600 h-4 w-4 border-gray-300 p-2 text-blue-500 focus:ring-blue-500 dark:text-blue-500 dark:checked:!border-blue-600 dark:checked:!bg-blue-500 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800',
          )}
        />
      </div>
      <div className="ml-2.5 inline-flex items-center space-x-4 text-sm leading-6 ">
        <label htmlFor={id}>{title}</label>{' '}
        {description && (
          <span
            id={`${id}-description`}
            className="dark:text-polar-400 inline-flex items-center space-x-1 text-gray-500"
          >
            <InformationCircleIcon className="h-6 w-6" />
            <span>{description}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default SettingsCheckbox
