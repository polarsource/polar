import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../MDXContentWrapper'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-row items-start gap-x-12">
      <div className="flex w-full flex-col">
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="flex w-80 flex-col">Test</div>
    </div>
  )
}
