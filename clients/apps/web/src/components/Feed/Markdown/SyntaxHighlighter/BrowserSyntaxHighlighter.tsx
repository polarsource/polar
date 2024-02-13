import { ContentPasteOutlined } from '@mui/icons-material'
import { Button } from 'polarkit/components/ui/atoms'

import { useTheme } from 'next-themes'
import { firstChild } from '../markdown'
import SyntaxHighlighter from './SyntaxHighlighter'
import { polarDark, polarLight } from './themes'

const BrowserSyntaxHighlighter = (props: {
  language: string | undefined
  children: React.ReactNode
}) => {
  const { language } = props
  const { resolvedTheme } = useTheme()
  const syntaxHighlighterTheme =
    resolvedTheme === 'dark' ? polarDark : polarLight

  const code = firstChild(props.children)

  if (!code) {
    return <></>
  }

  if (typeof code !== 'string') {
    return <></>
  }

  // Copy the code contents to the clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
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
        className="absolute right-6 top-6 h-8 w-8 rounded-full bg-gray-50 text-sm dark:bg-gray-900"
        onClick={handleCopy}
      >
        <ContentPasteOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

export default BrowserSyntaxHighlighter
