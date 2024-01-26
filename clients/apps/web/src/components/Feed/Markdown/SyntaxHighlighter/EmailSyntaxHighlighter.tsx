import SyntaxHighlighter from './SyntaxHighlighter'
import { polarLight } from './themes'

const EmailSyntaxHighlighter = (props: {
  language: string | undefined
  children: string
}) => {
  const { language, children: code } = props
  return (
    <div className="relative my-2 w-full">
      <SyntaxHighlighter language={language} code={code} theme={polarLight} />
    </div>
  )
}
export default EmailSyntaxHighlighter
