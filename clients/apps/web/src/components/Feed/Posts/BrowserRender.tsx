import Markdown from 'markdown-to-jsx'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
import BrowserMermaid from './BrowserMermaid'
import BrowserPoll from './BrowserPoll'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
import { SyntaxHighlighter } from './SyntaxHighlighter'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

export const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    // browser overrides
    poll: (args: any) => <Poll {...args} renderer={BrowserPoll} />,
    paywall: (args: any) => <Paywall {...args} />,
    SubscribeNow: (args: any) => <SubscribeNow {...args} />,
    embed: (args: any) => <Embed {...args} />,
    iframe: (args: any) => <Iframe {...args} />,
    pre: (args: any) => {
      if (args.children.type === 'code') {
        const language = args.children.props.className?.replace('lang-', '')
        if (language === 'mermaid') {
          return (
            <BrowserMermaid graphDefinition={args.children.props.children} />
          )
        }
        return (
          <SyntaxHighlighter language={language} {...args.children.props} />
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
    paywall: () => <></>,
    SubscribeNow: () => <></>,
    embed: () => <></>,
    iframe: () => <></>,
    pre: () => <></>,
  },
} as const

const BrowserRender = (props: {
  article: RenderArticle
  showPaywalledContent?: boolean
}) => {
  return (
    <Markdown
      options={{
        ...opts,
        createElement: wrapStrictCreateElement({
          article: props.article,
          showPaywalledContent: props.showPaywalledContent,
        }),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

export const AbbreviatedBrowserRender = (props: {
  article: RenderArticle
  showPaywalledContent?: boolean
}) => {
  return (
    <Markdown
      options={{
        ...previewOpts,
        createElement: wrapStrictCreateElement({
          article: props.article,
          showPaywalledContent: props.showPaywalledContent,
        }),
      }}
    >
      {props.article.body.substring(0, 500)}
    </Markdown>
  )
}

export default BrowserRender
