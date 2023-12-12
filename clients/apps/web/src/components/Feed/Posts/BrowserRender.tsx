// @ts-ignore
import Markdown from 'markdown-to-jsx'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
import BrowserPoll from './BrowserPoll'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
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
    code: (args: any) => (
      <SyntaxHighlighter language={args.language} style={dark}>
        {args.value}
      </SyntaxHighlighter>
    ),
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
