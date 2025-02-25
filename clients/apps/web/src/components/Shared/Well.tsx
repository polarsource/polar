import { twMerge } from 'tailwind-merge'

export interface WellProps {
  className?: string
  children: React.ReactNode
}

export const Well = ({ children, className }: WellProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex flex-col gap-y-4 rounded-3xl bg-gray-100 p-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface WellHeaderProps {
  className?: string
  children: React.ReactNode
}

export const WellHeader = ({ children, className }: WellHeaderProps) => {
  return (
    <div className={twMerge('flex flex-col gap-y-2', className)}>
      {children}
    </div>
  )
}

export interface WellContentProps {
  className?: string
  children: React.ReactNode
}

export const WellContent = ({ children, className }: WellContentProps) => {
  return (
    <div className={twMerge('flex flex-col gap-y-2', className)}>
      {children}
    </div>
  )
}

export interface WellFooterProps {
  className?: string
  children: React.ReactNode
}

export const WellFooter = ({ children, className }: WellFooterProps) => {
  return (
    <div className={twMerge('flex flex-col gap-y-2', className)}>
      {children}
    </div>
  )
}
