import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../MDXContentWrapper'
import { TableOfContents } from '../TableOfContents'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-row items-start gap-x-16">
      <div id="mdx-wrapper" className="flex w-full flex-shrink flex-col">
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="sticky top-12 flex w-52 flex-shrink-0 flex-col">
        <TableOfContents />
      </div>
    </div>
  )
}
