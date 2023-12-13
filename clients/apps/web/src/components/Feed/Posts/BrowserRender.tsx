// @ts-ignore
import Markdown from 'markdown-to-jsx'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
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
      if (!args.children) {
        return <></>
      }
      if (typeof args.children !== 'object') {
        return <></>
      }
      if (!('type' in args.children) || args.children.type !== 'code') {
        return <></>
      }
      return <SyntaxHighlighter {...args.children.props} />
    },
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
        createElement: wrapStrictCreateElement(
          props.article,
          props.showPaywalledContent,
        ),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

export default BrowserRender
