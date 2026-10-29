import { Button } from '@polar-sh/orbit'
import { Check, Copy } from '@polar-sh/orbit/icons'
import { useEffect, useState } from 'react'

const COPIED_DURATION_MS = 1500

export const CopyButton = ({
  value,
  label = 'Copy',
}: {
  value: string
  label?: string
}) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 [&_svg]:size-3!"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
      }}
    >
      {copied ? (
        <Check className="dark:text-polar-500 text-gray-400" />
      ) : (
        <Copy />
      )}
    </Button>
  )
}
