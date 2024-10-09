import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'

export const Section = ({
  id,
  children,
}: {
  id?: string
  children: React.ReactNode
}) => {
  return (
    <ShadowBoxOnMd
      className="relative flex flex-col gap-12 md:flex-row md:gap-24 md:p-12"
      id={id}
    >
      {children}
    </ShadowBoxOnMd>
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
    <div className="flex w-full flex-col gap-y-2 md:w-1/3">
      <h2 className="font-medium">{title}</h2>
      {description && (
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
