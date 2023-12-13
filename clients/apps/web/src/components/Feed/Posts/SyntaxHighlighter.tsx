'use client'

import { ContentPasteOutlined } from '@mui/icons-material'
import { useTheme } from 'next-themes'
import { Button } from 'polarkit/components/ui/atoms'
import ReactSyntaxHighlighter from 'react-syntax-highlighter'

export const SyntaxHighlighter = (props: {
  className?: string
  children: string
}) => {
  const { resolvedTheme } = useTheme()
  const style = resolvedTheme === 'dark' ? polarStyleDark : polarStyleLight

  // Language gets passed in as a className
  const language = props.className?.replace('lang-', '')

  // Copy the code contents to the clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(props.children)
  }

  return (
    <div className="relative my-2 w-full">
      <ReactSyntaxHighlighter
        language={language}
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

export const polarStyleLight: { [key: string]: React.CSSProperties } = {
  hljs: {
    display: 'block',
    overflowX: 'auto',
    margin: 0,
    padding: '2em',
    background: '#F3F4F7',
    color: '#00193a',
  },
  'hljs-comment': {
    color: '#008000',
  },
  'hljs-quote': {
    color: '#008000',
  },
  'hljs-variable': {
    color: '#008000',
  },
  'hljs-keyword': {
    color: '#00f',
  },
  'hljs-selector-tag': {
    color: '#00f',
  },
  'hljs-built_in': {
    color: '#00f',
  },
  'hljs-name': {
    color: '#00f',
  },
  'hljs-tag': {
    color: '#00f',
  },
  'hljs-string': {
    color: '#ef6464',
  },
  'hljs-title': {
    color: '#ef6464',
  },
  'hljs-section': {
    color: '#ef6464',
  },
  'hljs-attribute': {
    color: '#ef6464',
  },
  'hljs-literal': {
    color: '#ef6464',
  },
  'hljs-template-tag': {
    color: '#ef6464',
  },
  'hljs-template-variable': {
    color: '#ef6464',
  },
  'hljs-type': {
    color: '#ef6464',
  },
  'hljs-addition': {
    color: '#ef6464',
  },
  'hljs-deletion': {
    color: '#2b91af',
  },
  'hljs-selector-attr': {
    color: '#2b91af',
  },
  'hljs-selector-pseudo': {
    color: '#2b91af',
  },
  'hljs-meta': {
    color: '#2b91af',
  },
  'hljs-doctag': {
    color: '#808080',
  },
  'hljs-attr': {
    color: '#0062FF',
  },
  'hljs-symbol': {
    color: '#00b0e8',
  },
  'hljs-bullet': {
    color: '#00b0e8',
  },
  'hljs-link': {
    color: '#00b0e8',
  },
  'hljs-emphasis': {
    fontStyle: 'italic',
  },
  'hljs-strong': {
    fontWeight: 'bold',
  },
} as const

export const polarStyleDark: { [key: string]: React.CSSProperties } = {
  hljs: {
    display: 'block',
    overflowX: 'auto',
    margin: 0,
    padding: '2em',
    background: '#16171F',
    color: '#E5EFFF',
  },
  'hljs-keyword': {
    color: '#3381FF',
    fontStyle: 'italic',
  },
  'hljs-built_in': {
    color: '#99C0FF',
    fontStyle: 'italic',
  },
  'hljs-type': {
    color: '#80ed99',
  },
  'hljs-literal': {
    color: '#ff5874',
  },
  'hljs-number': {
    color: '#3381FF',
  },
  'hljs-regexp': {
    color: '#5ca7e4',
  },
  'hljs-string': {
    color: '#ecc48d',
  },
  'hljs-subst': {
    color: '#d3423e',
  },
  'hljs-symbol': {
    color: '#80ed99',
  },
  'hljs-class': {
    color: '#ffcb8b',
  },
  'hljs-function': {
    color: '#80ed99',
  },
  'hljs-title': {
    color: '#80ed99',
    fontStyle: 'italic',
  },
  'hljs-params': {
    color: '#13C4A3',
  },
  'hljs-comment': {
    color: '#4C5069',
    fontStyle: 'italic',
  },
  'hljs-doctag': {
    color: '#13C4A3',
  },
  'hljs-meta': {
    color: '#80ed99',
  },
  'hljs-meta-keyword': {
    color: '#80ed99',
  },
  'hljs-meta-string': {
    color: '#ecc48d',
  },
  'hljs-section': {
    color: '#82b1ff',
  },
  'hljs-tag': {
    color: '#13C4A3',
  },
  'hljs-name': {
    color: '#13C4A3',
  },
  'hljs-builtin-name': {
    color: '#13C4A3',
  },
  'hljs-attr': {
    color: '#13C4A3',
  },
  'hljs-attribute': {
    color: '#80cbc4',
  },
  'hljs-variable': {
    color: '#99C0FF',
  },
  'hljs-bullet': {
    color: '#d9f5dd',
  },
  'hljs-code': {
    color: '#80CBC4',
  },
  'hljs-emphasis': {
    color: '#3381FF',
    fontStyle: 'italic',
  },
  'hljs-strong': {
    color: '#99C0FF',
    fontWeight: 'bold',
  },
  'hljs-formula': {
    color: '#3381FF',
  },
  'hljs-link': {
    color: '#ff869a',
  },
  'hljs-quote': {
    color: '#697098',
    fontStyle: 'italic',
  },
  'hljs-selector-tag': {
    color: '#ff6363',
  },
  'hljs-selector-id': {
    color: '#fad430',
  },
  'hljs-selector-class': {
    color: '#99C0FF',
    fontStyle: 'italic',
  },
  'hljs-selector-attr': {
    color: '#3381FF',
    fontStyle: 'italic',
  },
  'hljs-selector-pseudo': {
    color: '#3381FF',
    fontStyle: 'italic',
  },
  'hljs-template-tag': {
    color: '#3381FF',
  },
  'hljs-template-variable': {
    color: '#99C0FF',
  },
  'hljs-addition': {
    color: '#99C0FFff',
    fontStyle: 'italic',
  },
  'hljs-deletion': {
    color: '#EF535090',
    fontStyle: 'italic',
  },
} as const
