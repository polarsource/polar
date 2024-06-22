import Markdown from 'markdown-to-jsx'
import BrowserCallout from '../Callout/BrowserCallout'
import { calloutRenderRule } from '../Callout/renderRule'
import {
  RenderArticle,
  markdownOpts,
  wrapStrictCreateElement,
} from '../markdown'
import { abbreviatedContent } from './utils'

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

    p: (args: any) => <p className="first:mt-0 last:mb-0">{args.children}</p>,

    img: (args: any) => (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img {...args} className="w-full first:mt-0 last:mb-0" />
    ),
  },
} as const

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
          extraAllowedCustomComponents: Object.keys(previewOpts.overrides),
        }),
        renderRule: calloutRenderRule(BrowserCallout),
      }}
    >
      {
        abbreviatedContent({
          body: article.body,
          includeBoundaryInBody: false,
          includeRefs: true,
        }).body
      }
    </Markdown>
  )
}
