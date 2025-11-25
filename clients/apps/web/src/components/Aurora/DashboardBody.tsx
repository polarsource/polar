import { twMerge } from 'tailwind-merge'

export const DashboardBody = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div className={twMerge('flex h-full w-full flex-col', className)}>
      {children}
    </div>
  )
}
