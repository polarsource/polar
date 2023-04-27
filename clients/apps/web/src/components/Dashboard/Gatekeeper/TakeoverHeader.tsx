const TakeoverBox = (props: { children: React.ReactElement }) => {
  return (
    <h1 className="text-center text-xl font-normal text-gray-600 drop-shadow-md">
      {props.children}
    </h1>
  )
}

export default TakeoverBox
