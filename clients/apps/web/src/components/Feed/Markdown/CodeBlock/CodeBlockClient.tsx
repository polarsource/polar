'use client'

import { SyntaxHighlighterClient } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { firstChild } from '../markdown'
import CopyToClipboardButton from './CopyToClipboardButton'

const CodeBlockClient = (props: {
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
      <SyntaxHighlighterClient lang={language || 'text'} code={code} />
      <CopyToClipboardButton code={code} />
    </div>
  )
}

export default CodeBlockClient
