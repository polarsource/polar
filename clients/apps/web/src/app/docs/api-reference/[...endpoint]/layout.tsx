import { AppLayoutProps } from 'next/app'

export default function Layout({ children }: AppLayoutProps) {
  return <div className="flex flex-row items-start gap-x-16">{children}</div>
}
