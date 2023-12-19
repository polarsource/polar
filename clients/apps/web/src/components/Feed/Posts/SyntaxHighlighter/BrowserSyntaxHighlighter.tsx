'use client'

import { ContentPasteOutlined } from '@mui/icons-material'
import { useTheme } from 'next-themes'
import { Button } from 'polarkit/components/ui/atoms'
import ReactSyntaxHighlighter from 'react-syntax-highlighter'
import { polarStyleDark, polarStyleLight } from './styles'

const BrowserSyntaxHighlighter = (props: {
  language: string | undefined
  children: string
}) => {
  const { resolvedTheme } = useTheme()
  const style = resolvedTheme === 'dark' ? polarStyleDark : polarStyleLight

  // Copy the code contents to the clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(props.children)
  }

  return (
    <div className="relative my-2 w-full">
      <ReactSyntaxHighlighter
        language={props.language}
        style={style}
        lineNumberStyle={{
          paddingRight: '1.5rem',
          opacity: '.2',
          fontSize: '.7rem',
        }}
        showLineNumbers
      >
        {props.children}
      </ReactSyntaxHighlighter>
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
