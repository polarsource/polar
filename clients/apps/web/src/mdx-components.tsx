import ProseWrapper from '@/components/Documentation/ProseWrapper'
import { TableOfContents } from '@/components/Documentation/TableOfContents'
import type { MDXComponents } from 'mdx/types'
import Image from 'next/image'

interface ImportedImageSrc {
  src: string
  height: number
  width: number
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}

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
    img: (props) => {
      /* If the `src` is a string, it's an absolute path we render as an `img` */
      if (typeof props.src === 'string') {
        console.warn(
          ` 🌄 Absolute image path detected, this is not recommended for performance reasons: ${props.src}\n Tip: place the image file beside the MDX file and use a relative import.`,
        )
        // eslint-disable-next-line
        return <img {...props} />
      }
      /* Otherwise, the `rehype-mdx-import-media` was able to `import` it locally: optimize with next/image */

      // Handle dark/light mode images
      let className = props.className || ''
      const src = props.src as unknown as ImportedImageSrc
      const modePattern = /(light|dark)\.[a-z0-9]{8}\.[a-z]+/
      const modeMatch = src.src.match(modePattern)

      if (modeMatch) {
        const mode = modeMatch[1]
        if (mode === 'light') {
          className = `${className} dark:hidden`
        } else {
          className = `${className} hidden dark:block`
        }
      }
      // @ts-ignore
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image {...props} className={className} />
    },
  }
}
