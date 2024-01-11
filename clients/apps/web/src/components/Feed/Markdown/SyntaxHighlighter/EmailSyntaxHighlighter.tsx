// SSR import fix. Ref: https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/493#issuecomment-1366043775
import ReactSyntaxHighlighter from 'react-syntax-highlighter/dist/esm/default-highlight'
import { polarStyleLight } from './styles'

const EmailSyntaxHighlighter = (props: {
  language: string | undefined
  children: string
}) => {
  return (
    <div className="relative my-2 w-full">
      <ReactSyntaxHighlighter
        language={props.language}
        style={polarStyleLight}
        lineNumberStyle={{
          paddingRight: '1.5rem',
          opacity: '.2',
          fontSize: '.7rem',
        }}
        showLineNumbers
      >
        {props.children}
      </ReactSyntaxHighlighter>
    </div>
  )
}
export default EmailSyntaxHighlighter
