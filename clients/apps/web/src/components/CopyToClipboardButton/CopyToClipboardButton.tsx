'use client'

import { CheckOutlined, ContentPasteOutlined } from '@mui/icons-material'
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
    <button type="button" onClick={handleCopy}>
      {!copied && <ContentPasteOutlined fontSize="inherit" />}
      {copied && <CheckOutlined fontSize="inherit" />}
    </button>
  )
}

export default CopyToClipboardButton
