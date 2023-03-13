const IconCounter = (props: { icon: string; count: number }) => {
  return (
    <>
      <div className="inline-flex items-center gap-1">
        <span className="text-lg">{props.icon}</span>
        <span className="text-sm text-gray-500">{props.count}</span>
      </div>
    </>
  )
}

export default IconCounter
