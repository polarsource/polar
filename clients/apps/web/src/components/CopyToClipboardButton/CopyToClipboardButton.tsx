'use client'

import { ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'

const CopyToClipboardButton = (props: { text: string }) => {
  const { text } = props

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Button size="icon" variant="ghost" className="" onClick={handleCopy}>
      <ContentPasteOutlined fontSize="inherit" />
    </Button>
  )
}

export default CopyToClipboardButton
