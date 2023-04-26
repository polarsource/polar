type InputProps = {
  name: string
  id: string
  placeholder?: string
  onUpdated?: (value: string) => void
} & typeof defaultProps

const defaultProps = {
  type: 'text',
}

const Input = (props: InputProps) => {
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
      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
      placeholder={props.placeholder}
      onChange={onChange}
    />
  )
}

Input.defaultProps = defaultProps

export default Input
