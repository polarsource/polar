import Markdown from 'markdown-to-jsx'
import dynamic from 'next/dynamic'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
import BrowserPoll from './BrowserPoll'
import { ImageOverlay } from './ImageOverlay'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
import BrowserSyntaxHighlighter from './SyntaxHighlighter/BrowserSyntaxHighlighter'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

const BrowserMermaid = dynamic(() => import('./BrowserMermaid'), { ssr: false })

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
          <BrowserSyntaxHighlighter
            language={language}
            {...args.children.props}
          />
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
