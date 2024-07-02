import ProseWrapper from '@/components/Documentation/ProseWrapper'
import { TableOfContents } from '@/components/Documentation/TableOfContents'
import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    BodyWrapper(props) {
      return (
        <article className="flex w-full max-w-3xl flex-shrink flex-col">
          <ProseWrapper>{props.children}</ProseWrapper>
        </article>
      )
    },
    TOCGenerator: ({ items }: { items: string }) => {
      const parsedItems = JSON.parse(items)
      return <TableOfContents items={parsedItems} />
    },
  }
}
