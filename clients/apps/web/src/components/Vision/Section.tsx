import { twMerge } from 'tailwind-merge'

export interface SectionProps {
  active: boolean
  header: {
    index: string
    name: string
  }
  title: string
  children: React.ReactNode
  context?: React.ReactNode
}

export const Section = ({
  active,
  header,
  title,
  children,
  context,
}: SectionProps) => {
  let desktopClasses = 'md:hidden'
  if (active) {
    desktopClasses = 'md:flex-row md:gap-x-32'
  }

  return (
    <div
      id={header.index}
      className={twMerge(desktopClasses, 'mb-16 flex flex-col gap-y-16')}
    >
      <div className="flex max-w-xl flex-col gap-y-8">
        <h1 className="text-balance text-4xl leading-tight">{title}</h1>
        <div className="flex flex-col gap-y-8 text-justify">{children}</div>
      </div>
      {context}
    </div>
  )
}
