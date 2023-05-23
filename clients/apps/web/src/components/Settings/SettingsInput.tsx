import { InformationCircleIcon } from '@heroicons/react/20/solid'

const SettingsInput = ({
  id,
  title,
  value,
  onChange,
  type = 'text',
  placeholder = undefined,
  description = undefined,
}: {
  id: string
  title: string
  description?: string
  value: string
  type: string
  placeholder?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
  return (
    <div className="relative flex flex-col items-start space-y-3">
      <div className="inline-flex items-center space-x-3 text-sm leading-6 ">
        <label htmlFor={id} className="font-medium text-gray-900">
          {title}
        </label>{' '}
        {description && (
          <span
            id={`${id}-description`}
            className="inline-flex items-center space-x-1 text-gray-500"
          >
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            <span>{description}</span>
          </span>
        )}
      </div>

      <div className="flex w-full items-center">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          name={id}
          type={type}
          placeholder={placeholder}
          onChange={onChange}
          value={value}
          className="w-full rounded-lg border-gray-300 p-2 py-1.5 text-gray-500 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

export default SettingsInput
