import { PropsWithChildren } from 'react'
import { MDXContentWrapper } from '../../../components/Documentation/MDXContentWrapper'
import { TableOfContents } from '../../../components/Documentation/TableOfContents'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <div
        id="mdx-wrapper"
        className="flex w-full max-w-3xl flex-shrink flex-col"
      >
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="flex w-full flex-shrink-0 flex-col md:sticky md:top-12 md:w-64">
        <TableOfContents />
      </div>
    </>
  )
}
