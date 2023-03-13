const Checkbox = (props: { id: string; children: any }) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={props.id}
          name={props.id}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-[#9171D9] focus:ring-[#9171D9]"
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
