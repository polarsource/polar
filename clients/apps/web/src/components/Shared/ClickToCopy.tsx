'use client'

import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { Box } from '@polar-sh/orbit/Box'

interface ClickToCopyProps {
  children: React.ReactNode
  value?: string
}

export const ClickToCopy = ({ children, value }: ClickToCopyProps) => {
  const safeCopy = useSafeCopy(toast)

  const copy = async (element: HTMLElement) => {
    if (window.getSelection()?.toString()) {
      return
    }
    const text = value ?? element.textContent ?? ''
    if (!text) {
      return
    }
    await safeCopy(text)
    toast({ title: 'Copied to clipboard', description: text })
  }

  return (
    <Box
      as="span"
      role="button"
      tabIndex={0}
      title="Click to copy"
      onClick={(event) => copy(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          copy(event.currentTarget)
        }
      }}
    >
      {children}
    </Box>
  )
}

export const copyable = (value: string | null | undefined) =>
  value ? <ClickToCopy>{value}</ClickToCopy> : value
