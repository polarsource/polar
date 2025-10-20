import ProseWrapper from '@/components/MDX/ProseWrapper'
import type { MDXComponents } from 'mdx/types'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

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
        <ProseWrapper className="flex w-full flex-col items-center md:max-w-7xl!">
          {props.children}
        </ProseWrapper>
      )
    },
    InnerHeaderWrapper(props) {
      return (
        <div
          className={twMerge(
            'prose-headings:font-normal prose-h1:leading-tight prose-headings:text-balance pt-6 text-center md:max-w-3xl md:pt-0 md:pb-6',
            props.className,
          )}
        >
          {props.children}
        </div>
      )
    },
    InnerWrapper(props) {
      return (
        <div
          className={twMerge(
            'flex w-full flex-col md:max-w-2xl',
            props.className,
          )}
        >
          {props.children}
        </div>
      )
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
