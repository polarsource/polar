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
          className="h-4 w-4 rounded border-gray-300 p-2 text-blue-500 transition-colors duration-200 hover:border-gray-400 focus:ring-blue-500"
        />
      </div>
      <div className="ml-3 text-sm leading-6">
        <label htmlFor={props.id} className="text-black">
          {props.children}
        </label>
      </div>
    </div>
  )
}
export default Checkbox
