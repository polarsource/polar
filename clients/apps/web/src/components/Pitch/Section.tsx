export interface SectionProps {
  header: {
    index: string
    name: string
  }
  title: string
  children: React.ReactNode
  context?: React.ReactNode
}

export const Section = ({ header, title, children, context }: SectionProps) => {
  return (
    <div className="flex flex-col gap-y-16 md:flex-row md:gap-x-32">
      <div className="flex max-w-lg flex-col gap-y-8">
        <div className="flex flex-row items-center gap-x-4">
          <span className="bg-polar-200 px-1 py-0.5 text-sm leading-none text-black">
            {header.index}.
          </span>
          <h1 className="text-lg">{header.name}</h1>
        </div>
        <h1 className="text-balance text-4xl leading-normal">{title}</h1>
        {children}
      </div>
      {context}
    </div>
  )
}
