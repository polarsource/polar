import Markdown from 'markdown-to-jsx'

import { Container } from '@react-email/components'
import EmailAd from './Ad/EmailAd'
import Embed from './Embed/EmailEmbed'
import Iframe from './Iframe/EmailIframe'
import EmailMermaid from './Mermaid/EmailMermaid'
import Paywall, { EmailPaywall } from './Paywall/Paywall'
import Poll from './Poll/Poll'
import EmailSyntaxHighlighter from './SyntaxHighlighter/EmailSyntaxHighlighter'
import {
  BenefitAds,
  RenderArticle,
  firstChild,
  markdownOpts,
  wrapStrictCreateElement,
} from './markdown'

export const opts = {
  ...markdownOpts,
  overrides: {
    ...markdownOpts.overrides,

    // email overrides
    poll: (args: any) => <Poll {...args} renderer={EmailPoll} />,
    Paywall: (args: any) => <Paywall {...args} renderer={EmailPaywall} />,
    SubscribeNow: () => <></>, // do not render
    embed: (args: any) => <Embed {...args} />,
    iframe: (args: any) => <Iframe {...args} />,
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
            return <EmailMermaid graphDefinition={contents} />
          }
        }
        return <EmailSyntaxHighlighter language={language} {...child.props} />
      }
      return <></>
    },
    Ad: (args: any) => <EmailAd {...args} />,
  },
} as const

const EmailRender = (props: {
  article: RenderArticle
  adsContext?: BenefitAds[]
}) => {
  return (
    <Markdown
      options={{
        ...opts,

        createElement: wrapStrictCreateElement({
          article: props.article,
          extraAllowedCustomComponents: Object.keys(opts.overrides),
          adsContext: props.adsContext,
        }),
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
