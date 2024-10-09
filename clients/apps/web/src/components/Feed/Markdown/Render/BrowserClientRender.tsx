import Markdown from 'markdown-to-jsx'
import dynamic from 'next/dynamic'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import BrowserAd from '../Ad/BrowserAd'
import BrowserCallout from '../Callout/BrowserCallout'
import { calloutRenderRule } from '../Callout/renderRule'
import CodeBlockClient from '../CodeBlock/CodeBlockClient'
import Embed from '../Embed/BrowserEmbed'
import Iframe from '../Iframe/BrowserIframe'
import { ImageOverlay } from '../Img/ImageOverlay'
import Paywall from '../Paywall/Paywall'
import BrowserPoll from '../Poll/BrowserPoll'
import Poll from '../Poll/Poll'
import {
  RenderArticle,
  firstChild,
  markdownOpts,
  wrapStrictCreateElement,
} from '../markdown'

const BrowserMermaid = dynamic(() => import('../Mermaid/BrowserMermaid'), {
  ssr: false,
  loading: () => (
    <Skeleton className="w-full p-8 font-mono text-sm">
      Initializing Mermaid Renderer...
    </Skeleton>
  ),
})

export const opts = {
  ...markdownOpts,

  overrides: {
    ...markdownOpts.overrides,

    // browser overrides
    poll: (args: any) => <Poll {...args} renderer={BrowserPoll} />,
    Paywall: (args: any) => <Paywall {...args} />,
    SubscribeNow: () => null,
    embed: (args: any) => <Embed {...args} />,
    iframe: (args: any) => <Iframe {...args} />,
    img: (args: any) => <ImageOverlay {...args} />,
    Ad: (args: any) => <BrowserAd {...args} />,
    footer: (args: any) => (
      <footer
        {...args}
        className="space-y-4 whitespace-pre-line border-t-[1px] border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-500 dark:text-gray-500"
      />
    ),
  },
} as const

export const BrowserClientRender = ({
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
        overrides: {
          ...opts.overrides,
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
              return <CodeBlockClient language={language} {...child.props} />
            }
            return <></>
          },
        },
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
