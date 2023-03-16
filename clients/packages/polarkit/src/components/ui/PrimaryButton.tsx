const PrimaryButton = (props) => {
  return (
    <>
      <button
        className="m-auto w-full rounded-lg bg-purple-500 p-2 text-center text-sm font-medium text-white"
        onClick={props.onClick}
      >
        {props.children}
      </button>
    </>
  )
}
export default PrimaryButton
