import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../MDXContentWrapper'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-row items-start gap-x-24">
      <div className="flex w-full flex-shrink flex-col">
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="flex w-52 flex-shrink-0 flex-col">Test</div>
    </div>
  )
}
