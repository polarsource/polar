export const Section = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mb-8 flex flex-col space-y-4  pt-8 xl:flex-row xl:space-x-12 xl:space-y-0">
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
    <div className="flex-shrink-0 xl:w-60">
      <h2 className="mb-2 font-medium">{title}</h2>
      {description && (
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
