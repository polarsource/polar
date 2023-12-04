import { Article } from '@polar-sh/sdk'

// @ts-ignore
import Markdown from 'markdown-to-jsx'

import { Container } from '@react-email/components'
import Paywall from './Paywall'
import Poll from './Poll'
import { markdownOpts, wrapStrictCreateElement } from './markdown'

export const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    // email overrides
    poll: (args: any) => <Poll {...args} renderer={EmailPoll} />,
    paywall: (args: any) => <Paywall {...args} />,
    SubscribeNow: () => <></>, // do not render
  },
} as const

const EmailRender = (props: { article: Article }) => {
  return (
    <Markdown
      // @ts-ignore
      options={{
        ...opts,

        createElement: wrapStrictCreateElement(props.article),
      }}
    >
      {props.article.body}
    </Markdown>
  )
}

export default EmailRender

const EmailPoll = (props: { options: string[] }) => {
  return (
    <Container className="my-2 bg-green-300 p-8">
      <table className="w-full">
        {props.options.map((s) => (
          <tr key={s}>
            <td>{s}</td>
            <td className="text-right">123 votes (10%)</td>
          </tr>
        ))}
      </table>
    </Container>
  )
}
