import { CheckOutlined } from '@mui/icons-material'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Button from './Button'
import Input from './Input'

const CopyToClipboardInput = ({
  value,
  onCopy,
  buttonLabel,
  disabled = false,
  className = '',
}: {
  value: string
  onCopy?: () => void
  buttonLabel?: string
  disabled?: boolean
  className?: string
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value)

    if (onCopy) {
      onCopy()
    }

    setIsCopied(true)

    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 flex w-full flex-row items-center overflow-hidden rounded-full border bg-white shadow-sm',
        className,
      )}
    >
      <Input
        className="dark:text-polar-400 !focus:border-transparent !focus:ring-transparent !dark:focus:border-transparent !dark:focus:ring-transparent w-full grow border-none bg-transparent font-mono text-xs text-gray-600 !shadow-none focus-visible:ring-transparent dark:bg-transparent dark:focus-visible:ring-transparent"
        value={value}
        readOnly={true}
      />
      {!disabled && (
        <Button
          className="mr-1 text-xs"
          type="button"
          variant="ghost"
          onClick={copyToClipboard}
        >
          {isCopied ? (
            <CheckOutlined className="text-sm" fontSize="inherit" />
          ) : (
            buttonLabel || 'Copy'
          )}
        </Button>
      )}
    </div>
  )
}

export default CopyToClipboardInput
