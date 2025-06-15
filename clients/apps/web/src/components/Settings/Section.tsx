export const Section = ({
  id,
  children,
}: {
  id?: string
  children: React.ReactNode
}) => {
  return (
    <div
      className="relative flex flex-col gap-12 xl:flex-row xl:gap-24"
      id={id}
    >
      {children}
    </div>
  )
}

export const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => {
  return (
    <div className="flex w-full flex-col gap-y-2 xl:w-1/3">
      <h2 className="text-lg font-medium">{title}</h2>
      {description && (
        <p className="dark:text-polar-500 text-gray-500">{description}</p>
      )}
    </div>
  )
}
