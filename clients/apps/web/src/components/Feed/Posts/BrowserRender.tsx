import Markdown from 'markdown-to-jsx'
import dynamic from 'next/dynamic'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { createContext, useContext } from 'react'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
import BrowserPoll from './BrowserPoll'
import { ImageOverlay } from './ImageOverlay'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

const BrowserMermaid = dynamic(() => import('./BrowserMermaid'), {
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
    <pre className="w-[2000px] max-w-full">
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
      if (args.children.type === 'code') {
        const language = args.children.props.className?.replace('lang-', '')
        if (language === 'mermaid') {
          return (
            <BrowserMermaid graphDefinition={args.children.props.children} />
          )
        }
        return (
          <SyntaxHighlighterContext.Provider
            value={args.children.props.children}
          >
            <BrowserSyntaxHighlighter
              language={language}
              {...args.children.props}
            />
          </SyntaxHighlighterContext.Provider>
        )
      }
      return <></>
    },
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
}: {
  article: RenderArticle
  showPaywalledContent: boolean
  isSubscriber: boolean
}) => {
  return (
    <Markdown
      options={{
        ...opts,
        createElement: wrapStrictCreateElement({
          article,
          showPaywalledContent,
          isSubscriber,
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
      {article.body.substring(0, 500).split('\n').slice(0, 4).join('\n')}
    </Markdown>
  )
}

export default BrowserRender
