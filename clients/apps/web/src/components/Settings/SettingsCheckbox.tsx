import { InformationCircleIcon } from '@heroicons/react/24/outline'

const SettingsCheckbox = ({
  id,
  title,
  isChecked,
  onChange,
  description = undefined,
}: {
  id: string
  title: string
  description?: string
  isChecked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          name={id}
          type="checkbox"
          onChange={onChange}
          checked={isChecked}
          className="h-4 w-4 rounded border-gray-300 text-[#8A63F9] focus:ring-[#8A63F9]"
        />
      </div>
      <div className="ml-3 inline-flex items-center space-x-4 text-sm leading-6 ">
        <label htmlFor={id} className="font-medium text-black">
          {title}
        </label>{' '}
        {description && (
          <span
            id={`${id}-description`}
            className="inline-flex items-center space-x-2 text-black/50"
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
