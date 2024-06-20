import SyntaxHighlighter from '@/components/SyntaxHighlighter/SyntaxHighlighter'
import { polarLight } from '@/components/SyntaxHighlighter/themes'
import { firstChild } from '../markdown'

const EmailSyntaxHighlighter = (props: {
  language: string | undefined
  children: React.ReactNode
}) => {
  const { language } = props

  const code = firstChild(props.children)

  if (!code) {
    return <></>
  }

  if (typeof code !== 'string') {
    return <></>
  }

  return (
    <div className="relative my-2 w-full">
      <SyntaxHighlighter
        language={language}
        code={code}
        theme={polarLight}
        lineNumbers
      />
    </div>
  )
}
export default EmailSyntaxHighlighter
