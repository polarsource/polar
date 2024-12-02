'use client'

import { CheckOutlined, ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'
import { useState } from 'react'

const CopyToClipboardButton = (props: { text: string }) => {
  const { text } = props
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  return (
    <Button
      className="ml-0.5 h-6 w-6"
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
    >
      {!copied && <ContentPasteOutlined fontSize="inherit" />}
      {copied && <CheckOutlined fontSize="inherit" />}
    </Button>
  )
}

export default CopyToClipboardButton
