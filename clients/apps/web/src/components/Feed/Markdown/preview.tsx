import { Article } from '@polar-sh/sdk'
import { decode } from 'html-entities'
import Markdown from 'markdown-to-jsx'
import { markdownOpts, wrapStrictCreateElement } from './markdown'

export const previewOpts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,
    p: (args: any) => <>{args.children} </>, // Note the space
    div: (args: any) => <>{args.children} </>, // Note the space
    img: (args: any) => <></>,
    a: (args: any) => <>{args.children}</>,
    strong: (args: any) => <>{args.children}</>,
    em: (args: any) => <>{args.children}</>,
  },
} as const

// Text only renderer. Used to generate contents for og:description and similar
export default function PreviewText(props: { article: Article }) {
  return (
    <Markdown
      options={{
        ...previewOpts,
        createElement: wrapStrictCreateElement({
          article: props.article,
          showPaywalledContent: false,
          extraAllowedCustomComponents: [
            'p',
            'div',
            'img',
            'a',
            'strong',
            'em',
          ],

          // Default override that removes all elements
          defaultOverride: (args: any) => <>{args.children}</>,
        }),
        wrapper: (args: any) => <>{args.children}</>,
      }}
    >
      {props.article.body.substring(0, 500)}
    </Markdown>
  )
}

export function UnescapeText(str: string): string {
  return decode(str, { scope: 'strict' }).trim()
}
