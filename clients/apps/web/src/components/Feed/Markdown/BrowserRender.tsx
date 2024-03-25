import Markdown from 'markdown-to-jsx'
import dynamic from 'next/dynamic'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { createContext, useContext } from 'react'
import BrowserAd from './Ad/BrowserAd'
import BrowserCallout from './Callout/BrowserCallout'
import { calloutRenderRule } from './Callout/renderRule'
import Embed from './Embed/BrowserEmbed'
import Iframe from './Iframe/BrowserIframe'
import { ImageOverlay } from './Img/ImageOverlay'
import Paywall from './Paywall/Paywall'
import BrowserPoll from './Poll/BrowserPoll'
import Poll from './Poll/Poll'
import SubscribeNow from './SubscribeNow/SubscribeNow'
import {
  RenderArticle,
  firstChild,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

const BrowserMermaid = dynamic(() => import('./Mermaid/BrowserMermaid'), {
  ssr: false,
  loading: () => (
    <Skeleton className="w-full p-8 font-mono text-sm">
      Initializing Mermaid Renderer...
    </Skeleton>
  ),
})

// Dynamically load the SyntaxHighlighter (heavily reduces bundle sizes)
//
// While loading (and SSR), render a placeholder without syntax highlighting
const SyntaxHighlighterContext = createContext('')
const BrowserSyntaxHighlighter = dynamic(
  () => import('./SyntaxHighlighter/BrowserSyntaxHighlighter'),
  {
    ssr: false,
    loading: () => <BrowserSyntaxHighlighterLoading />,
  },
)

const BrowserSyntaxHighlighterLoading = () => {
  const value = useContext(SyntaxHighlighterContext)
  return (
    <pre className="w-full">
      <code className="text-black dark:text-white">{value}</code>
    </pre>
  )
}

export const opts = {
  ...markdownOpts,

  overrides: {
    ...markdownOpts.overrides,

    // browser overrides
    poll: (args: any) => <Poll {...args} renderer={BrowserPoll} />,
    Paywall: (args: any) => <Paywall {...args} />,
    SubscribeNow: (args: any) => <SubscribeNow {...args} />,
    embed: (args: any) => <Embed {...args} />,
    iframe: (args: any) => <Iframe {...args} />,
    img: (args: any) => <ImageOverlay {...args} />,
    pre: (args: any) => {
      const child = firstChild(args.children)
      if (!child) {
        return <></>
      }

      if (
        typeof child === 'object' &&
        'type' in child &&
        child.type === 'code'
      ) {
        const language = child.props.className?.replace('lang-', '')
        if (language === 'mermaid') {
          const contents = firstChild(child.props.children)
          if (contents && typeof contents === 'string') {
            return <BrowserMermaid graphDefinition={contents} />
          }
        }
        return (
          <SyntaxHighlighterContext.Provider value={child.props.children}>
            <BrowserSyntaxHighlighter language={language} {...child.props} />
          </SyntaxHighlighterContext.Provider>
        )
      }
      return <></>
    },
    Ad: (args: any) => <BrowserAd {...args} />,
    footer: (args: any) => (
      <footer
        {...args}
        className="space-y-4 whitespace-pre-line border-t-[1px] border-gray-300 pt-4 text-xs text-gray-500 dark:border-gray-500 dark:text-gray-500"
      />
    ),
  },
} as const

export const previewOpts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    poll: () => <></>,
    Paywall: () => <></>,
    SubscribeNow: () => <></>,
    embed: () => <></>,
    iframe: () => <></>,
    pre: () => <></>,

    p: (args: any) => <p className="first:mt-0 last:mb-0">{args.children}</p>,

    img: (args: any) => (
      <img {...args} className="w-full first:mt-0 last:mb-0" />
    ),
  },
} as const

const BrowserRender = ({
  article,
  showPaywalledContent,
  isSubscriber,
  paidArticlesBenefitName,
}: {
  article: RenderArticle
  showPaywalledContent: boolean
  isSubscriber: boolean
  paidArticlesBenefitName?: string
}) => {
  return (
    <Markdown
      options={{
        ...opts,
        createElement: wrapStrictCreateElement({
          article,
          showPaywalledContent,
          isSubscriber,
          paidArticlesBenefitName,
          extraAllowedCustomComponents: Object.keys(opts.overrides),
        }),
        renderRule: calloutRenderRule(BrowserCallout),
      }}
    >
      {article.body}
    </Markdown>
  )
}

export const AbbreviatedBrowserRender = ({
  article,
  showPaywalledContent,
}: {
  article: RenderArticle
  showPaywalledContent?: boolean
}) => {
  return (
    <Markdown
      options={{
        ...previewOpts,
        createElement: wrapStrictCreateElement({
          article,
          showPaywalledContent,
          isSubscriber: true, // Do not show <SubscribeNow /> in abbreviations
          extraAllowedCustomComponents: Object.keys(previewOpts.overrides),
        }),
        renderRule: calloutRenderRule(BrowserCallout),
      }}
    >
      {
        abbreviatedContent({
          body: article.body,
          includeBoundaryInBody: false,
          includeRefs: true,
        }).body
      }
    </Markdown>
  )
}

export default BrowserRender

export type AbbreviatedContentResult = {
  body: string
  manualBoundary: boolean
  matchedBoundary?: string
}

// Regex that matches references, but not footnotes.
//
// Examples:
//
// [reference]: https://polar.sh
// [reference]: https://polar.sh
// [3]: <https://polar.sh> "Polar"
//
// Does not matches footnotes:
//
// [^4]: footnote
const referencesMatch = /^\[[^\^](.*)\]: (.*)$/gm

export const getReferences = (body: string): string[] => {
  const matches = body.matchAll(referencesMatch)

  const res: string[] = []

  for (const m of matches) {
    res.push(m[0])
  }

  return res
}

// must be synced with Article.abbreviated_content on the backend
export const abbreviatedContent = ({
  body,
  includeBoundaryInBody,
  includeRefs,
}: {
  body: string
  includeBoundaryInBody: boolean
  includeRefs?: boolean
}): AbbreviatedContentResult => {
  const res = parseBoundary({ body, includeBoundaryInBody })

  // Add references that would otherwise end up below the boundary
  if (includeRefs) {
    res.body += '\n\n' + getReferences(body).join('\n')
  }

  return res
}

const parseBoundary = ({
  body,
  includeBoundaryInBody,
}: {
  body: string
  includeBoundaryInBody: boolean
}): AbbreviatedContentResult => {
  const res: string[] = []
  let l = 0

  // If the post has a <hr> within 1000 characters, use that as the limit.

  const boundaries = ['---\n', '<hr>\n', '<hr/>\n', '<hr />\n']

  let firstAt: number | undefined = undefined
  let firstBoundary: string | undefined = undefined

  for (const b of boundaries) {
    const idx = body.indexOf(b)
    if (idx >= 0) {
      if (firstAt === undefined || idx < firstAt) {
        firstAt = idx
        firstBoundary = b
      }
    }
  }

  // Support for more than three dashes in a row, "-----\n" is also a boundary
  if (firstAt && firstBoundary === '---\n') {
    let newFirstAt = firstAt
    while (body.at(newFirstAt - 1) === '-') {
      newFirstAt--
    }
    firstBoundary = body.substring(newFirstAt, firstAt + firstBoundary.length)
    firstAt = newFirstAt
  }

  if (firstAt !== undefined && firstBoundary !== undefined && firstAt < 1000) {
    let retbod = body.substring(0, firstAt).trimEnd()
    if (includeBoundaryInBody) {
      retbod = body.substring(0, firstAt + firstBoundary.length)
    }

    return {
      body: retbod,
      manualBoundary: true,
      matchedBoundary: firstBoundary,
    }
  }

  const parts = body.substring(0, 1000).replaceAll('\r\n', '\n').split('\n\n')

  for (const p of parts) {
    if (p.length + l > 500 && l > 0) {
      break
    }

    l += p.length
    res.push(p)
  }

  return { body: res.join('\n\n').trimEnd(), manualBoundary: false }
}
