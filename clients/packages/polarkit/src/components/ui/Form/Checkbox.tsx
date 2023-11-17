import { ChangeEvent } from 'react'

const Checkbox = (props: {
  id: string
  children: any
  value: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={props.id}
          name={props.id}
          type="checkbox"
          checked={props.value}
          onChange={props.onChange}
          className="dark:bg-polar-800 dark:border-polar-600 h-4 w-4 rounded border-gray-300 bg-white p-2 text-blue-500 transition-colors duration-200 hover:border-gray-400 focus:ring-blue-600 dark:text-blue-400 dark:checked:!border-blue-500 dark:checked:!bg-blue-500 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800"
        />
      </div>
      <div className="ml-3 text-sm leading-6">
        <label htmlFor={props.id}>{props.children}</label>
      </div>
    </div>
  )
}

export default Checkbox
