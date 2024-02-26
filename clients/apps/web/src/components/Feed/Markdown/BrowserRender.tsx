import Markdown from 'markdown-to-jsx'
import dynamic from 'next/dynamic'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { createContext, useContext } from 'react'
import BrowserAd from './Ad/BrowserAd'
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
        }),
      }}
    >
      {abbreviatedContent(article.body).body}
    </Markdown>
  )
}

export default BrowserRender

export type AbbreviatedContentResult = {
  body: string
  manualBoundary: boolean
  matchedBoundary?: string
}

// must be synced with Article.abbreviated_content on the backend
export const abbreviatedContent = (body: string): AbbreviatedContentResult => {
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

  if (firstAt !== undefined && firstBoundary !== undefined && firstAt < 1000) {
    return {
      body: body.substring(0, firstAt + firstBoundary.length),
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
