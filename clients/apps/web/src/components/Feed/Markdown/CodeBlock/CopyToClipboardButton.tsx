'use client'

import { ContentPasteOutlined } from '@mui/icons-material'
import Button from 'polarkit/components/ui/atoms/button'

const CopyToClipboardButton = (props: { code: string }) => {
  const { code } = props

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
  }

  return (
    <Button
      size="icon"
      variant="secondary"
      className="absolute right-6 top-6 h-8 w-8 rounded-full bg-gray-50 text-sm dark:bg-gray-900"
      onClick={handleCopy}
    >
      <ContentPasteOutlined fontSize="inherit" />
    </Button>
  )
}

export default CopyToClipboardButton
