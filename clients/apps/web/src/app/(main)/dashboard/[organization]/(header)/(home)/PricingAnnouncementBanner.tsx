'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useCallback, useState } from 'react'

const DISMISS_KEY = 'pricing_announcement_banner_dismissed'

const getIsDismissed = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  return localStorage.getItem(DISMISS_KEY) === 'true'
}

export const PricingAnnouncementBanner = () => {
  const [isDismissed, setIsDismissed] = useState(() => getIsDismissed())

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.setItem(DISMISS_KEY, 'true')
    setIsDismissed(true)
  }, [])

  if (isDismissed) {
    return null
  }

  return (
    <Box
      position="relative"
      display="flex"
      flexDirection="column"
      alignItems="start"
      rowGap="l"
      borderRadius="l"
      backgroundColor="background-card"
      padding={{ base: 'l', md: 'xl' }}
    >
      <Box
        display="flex"
        flexDirection="column"
        rowGap="s"
        maxWidth={720}
        paddingRight="xl"
      >
        <Text variant="heading-xs" as="strong">
          Introducing Polar Plans
        </Text>
        <Text color="muted">
          Three new optional paid plans; <b>Pro</b>, <b>Growth</b> and{' '}
          <b>Scale</b>. With lower transaction fees and prioritized support. No
          sales process, no negotiations.
        </Text>
      </Box>
      <Link
        href="https://polar.sh/resources/pricing"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button>Read the blog post</Button>
      </Link>
      <Box position="absolute" top={12} right={12}>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="dark:text-polar-500 dark:hover:text-polar-300 cursor-pointer text-gray-400 transition-colors hover:text-gray-600"
        >
          <CloseOutlined fontSize="small" />
        </button>
      </Box>
    </Box>
  )
}
