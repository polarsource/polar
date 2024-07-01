import APILayout from '@/components/Documentation/APILayout'
import { MDXContentWrapper } from '@/components/Documentation/MDXContentWrapper'
import { TableOfContents } from '@/components/Documentation/TableOfContents'
import { fetchSchema } from '@/components/Documentation/openapi'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const openAPISchema = await fetchSchema()
  return (
    <APILayout openAPISchema={openAPISchema}>
      <div
        id="mdx-wrapper"
        className="flex w-full max-w-3xl flex-shrink flex-col"
      >
        <MDXContentWrapper>{children}</MDXContentWrapper>
      </div>
      <div className="flex w-full flex-shrink-0 flex-col md:sticky md:top-12 md:w-64">
        <TableOfContents />
      </div>
    </APILayout>
  )
}
