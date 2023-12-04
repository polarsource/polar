import { Article } from '@polar-sh/sdk'

// @ts-ignore
import Markdown from 'markdown-to-jsx'
import BrowserPoll from './BrowserPoll'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
import { markdownOpts, wrapStrictCreateElement } from './markdown'

export const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    // browser overrides
    poll: (args: any) => <Poll {...args} renderer={BrowserPoll} />,
    paywall: (args: any) => <Paywall {...args} />,
    SubscribeNow: (args: any) => <SubscribeNow {...args} />,
  },
} as const

const BrowserRender = (props: { article: Article }) => {
  return (
    <Markdown
      options={{
        ...opts,
        createElement: wrapStrictCreateElement(props.article),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

export default BrowserRender
