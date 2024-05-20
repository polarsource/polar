import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../MDXContentWrapper'
import { TableOfContents } from '../TableOfContents'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col-reverse gap-x-16 gap-y-16 md:flex-row md:items-start">
      <div id="mdx-wrapper" className="flex w-full flex-shrink flex-col">
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="flex w-full flex-shrink-0 flex-col md:sticky md:top-12 md:w-52">
        <TableOfContents />
      </div>
    </div>
  )
}
