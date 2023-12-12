// @ts-ignore
import { ContentPasteOutlined } from '@mui/icons-material'
import Markdown from 'markdown-to-jsx'
import { Button } from 'polarkit/components/ui/atoms'
import SyntaxHighlighter from 'react-syntax-highlighter'
import Embed from './BrowserEmbed'
import Iframe from './BrowserIframe'
import BrowserPoll from './BrowserPoll'
import Paywall from './Paywall'
import Poll from './Poll'
import SubscribeNow from './SubscribeNow'
import { polarStyle } from './SyntaxHighlighter'
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
    code: (args: any) => {
      // Language gets passed in as a className
      const language = args.className?.replace('lang-', '')

      // Copy the code contents to the clipboard
      const handleCopy = () => {
        navigator.clipboard.writeText(args.children)
      }

      return (
        <div className="relative w-full">
          <SyntaxHighlighter
            language={language}
            style={polarStyle}
            lineNumberStyle={{
              paddingRight: '1.5rem',
              opacity: '.2',
              fontSize: '.7rem',
            }}
            showLineNumbers
          >
            {args.children}
          </SyntaxHighlighter>
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-4 top-4 h-8 w-8 rounded-full text-sm"
            onClick={handleCopy}
          >
            <ContentPasteOutlined fontSize="inherit" />
          </Button>
        </div>
      )
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
