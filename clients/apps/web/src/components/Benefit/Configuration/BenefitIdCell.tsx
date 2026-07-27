'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { useToast } from '@/components/Toast/use-toast'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const COPIED_RESET_MS = 1600

export const BenefitIdCell = ({ id }: { id: string }) => {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timeout = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
    } catch {
      toast({
        title: 'Benefit ID Copy Failed',
        description: 'Could not write the benefit ID to your clipboard',
      })
    }
  }, [id, toast])

  return (
    <DetailCell
      label="Benefit ID"
      value={
        <Box
          minWidth={0}
          alignItems="center"
          columnGap="s"
          cursor={{ hover: 'pointer' }}
          color={{ base: 'text-primary', hover: 'text-secondary' }}
          transitionProperty="colors"
          transitionDuration="fast"
          onClick={copy}
        >
          <Text variant="body" monospace truncate>
            {id}
          </Text>
          <Box flexShrink={0} color="text-tertiary">
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          </Box>
        </Box>
      }
    />
  )
}
