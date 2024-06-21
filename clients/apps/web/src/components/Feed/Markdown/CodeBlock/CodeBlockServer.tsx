import SyntaxHighlighterServer, {
  Highlighter,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { firstChild } from '../markdown'
import CopyToClipboardButton from './CopyToClipboardButton'

const CodeBlockServer = (props: {
  language: string | undefined
  highlighter: Highlighter
  children: React.ReactNode
}) => {
  const { language, highlighter } = props
  const code = firstChild(props.children)

  if (!code) {
    return <></>
  }

  if (typeof code !== 'string') {
    return <></>
  }

  return (
    <div className="relative my-2 w-full">
      <SyntaxHighlighterServer
        lang={language || 'text'}
        code={code}
        highlighter={highlighter}
      />
      <CopyToClipboardButton code={code} />
    </div>
  )
}

export default CodeBlockServer
