import { firstChild } from '../markdown'
import SyntaxHighlighter from './SyntaxHighlighter'
import { polarLight } from './themes'

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
      <SyntaxHighlighter language={language} code={code} theme={polarLight} />
    </div>
  )
}
export default EmailSyntaxHighlighter
