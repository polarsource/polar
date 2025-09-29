import ProseWrapper from '@/components/MDX/ProseWrapper'
import { PropsWithChildren } from 'react'

export const dynamic = 'force-static'
export const dynamicParams = false

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col items-center md:w-full">
      <ProseWrapper className="flex flex-col items-center md:w-full lg:max-w-6xl!">
        {children}
      </ProseWrapper>
    </div>
  )
}
