'use client'

import { CheckOutlined, ContentPasteOutlined } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useState } from 'react'

const CopyToClipboardButton = (props: {
  text: string
  onCopy?: () => void
}) => {
  const { text, onCopy } = props
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)

    onCopy?.()

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
