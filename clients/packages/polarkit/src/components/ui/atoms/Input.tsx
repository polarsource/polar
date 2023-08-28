import { HTMLInputTypeAttribute } from 'react'

const Input = (props: {
  name: string
  id: string
  placeholder?: string
  onUpdated?: (value: string) => void
  type: HTMLInputTypeAttribute
  value: string
}) => {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (props.onUpdated) {
      props.onUpdated(e.target.value)
    }
  }

  return (
    <input
      type={props.type}
      name={props.name}
      id={props.id}
      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:ring-gray-700 dark:focus:ring-blue-500 dark:focus:ring-offset-gray-800 sm:text-sm sm:leading-6"
      placeholder={props.placeholder}
      onChange={onChange}
      value={props.value}
    />
  )
}

export default Input
