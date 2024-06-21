import SyntaxHighlighterServer, {
  Highlighter,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterServer'
import { firstChild } from '../markdown'

const CodeBlockEmail = (props: {
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
    <div className="relative my-2 w-full rounded-2xl bg-gray-100 p-1 px-4">
      <SyntaxHighlighterServer
        lang={language || 'text'}
        code={code}
        highlighter={highlighter}
      />
    </div>
  )
}

export default CodeBlockEmail
