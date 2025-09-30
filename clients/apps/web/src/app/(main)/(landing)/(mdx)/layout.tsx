import ProseWrapper from '@/components/MDX/ProseWrapper'
import { PropsWithChildren } from 'react'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col items-center md:w-full">
      <ProseWrapper className="lg:max-w-6xl! flex flex-col items-center md:w-full">
        {children}
      </ProseWrapper>
    </div>
  )
}
