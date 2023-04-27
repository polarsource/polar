const TakeoverBox = (props: { children: React.ReactElement }) => {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="min-w-[700px] ">
        <div className="flex flex-col space-y-8">{props.children}</div>
      </div>
    </div>
  )
}

export default TakeoverBox
