import { PropsWithChildren } from 'react'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function VisionLayout({ children }: PropsWithChildren) {
  return <>{children}</>
}
