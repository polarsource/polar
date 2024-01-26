import { ContentPasteOutlined } from '@mui/icons-material'
import { Button } from 'polarkit/components/ui/atoms'

import { useTheme } from 'next-themes'
import SyntaxHighlighter from './SyntaxHighlighter'
import { polarDark, polarLight } from './themes'

const BrowserSyntaxHighlighter = (props: {
  language: string | undefined
  children: string
}) => {
  const { language, children: code } = props
  const { resolvedTheme } = useTheme()
  const syntaxHighlighterTheme =
    resolvedTheme === 'dark' ? polarDark : polarLight

  // Copy the code contents to the clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(props.children)
  }

  return (
    <div className="relative my-2 w-full">
      <div className="not-prose">
        <SyntaxHighlighter
          language={language}
          code={code}
          theme={syntaxHighlighterTheme}
        />
      </div>
      <Button
        size="icon"
        variant="secondary"
        className="absolute right-6 top-6 h-8 w-8 rounded-full text-sm"
        onClick={handleCopy}
      >
        <ContentPasteOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

export default BrowserSyntaxHighlighter
