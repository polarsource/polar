const Icon = ({
  icon,
  classes,
}: {
  classes: string
  icon: React.ReactElement
}) => {
  return (
    <div
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${classes}`}
    >
      {icon}
    </div>
  )
}

export default Icon
