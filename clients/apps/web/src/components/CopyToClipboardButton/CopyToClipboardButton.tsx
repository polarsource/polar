'use client'

import { CheckOutlined, ContentPasteOutlined } from '@mui/icons-material'
import Button, { ButtonProps } from '@polar-sh/ui/components/atoms/Button'
import { PropsWithChildren, useState } from 'react'

const CopyToClipboardButton = (
  props: PropsWithChildren<{
    text: string
    buttonProps?: ButtonProps
    onCopy?: () => void
  }>,
) => {
  const { text, onCopy } = props
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
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
      {...props.buttonProps}
      onClick={handleCopy}
    >
      {!copied &&
        (props.children ? (
          props.children
        ) : (
          <ContentPasteOutlined fontSize="inherit" />
        ))}
      {copied && <CheckOutlined fontSize="inherit" />}
    </Button>
  )
}

export default CopyToClipboardButton
