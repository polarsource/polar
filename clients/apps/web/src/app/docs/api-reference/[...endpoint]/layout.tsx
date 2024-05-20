import { AppLayoutProps } from 'next/app'

export default function Layout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col gap-x-16 gap-y-16 md:flex-row md:items-start">
      {children}
    </div>
  )
}
