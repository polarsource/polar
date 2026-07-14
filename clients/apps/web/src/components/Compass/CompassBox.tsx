'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CompassInputBar } from './CompassInputBar'

/**
 * The Compass entry point on the overview: a pill stuck to the bottom of the
 * dashboard body (within the content column, never over the sidebar) with a
 * gradient fading the overview under it. The conversation itself lives on the
 * /compass route; focusing the pill navigates there, and anything already
 * typed rides along via `?ask=` so it becomes the first question.
 */
export const CompassBox = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [value, setValue] = useState('')
  const router = useRouter()
  const compassUrl = `/dashboard/${organization.slug}/compass`

  const openCompass = (question?: string) => {
    const content = question?.trim()
    router.push(
      content ? `${compassUrl}?ask=${encodeURIComponent(content)}` : compassUrl,
    )
  }

  return (
    <Box
      position="sticky"
      left={0}
      right={0}
      bottom={0}
      zIndex={30}
      display="flex"
      justifyContent="center"
      alignItems="end"
      paddingHorizontal={{ base: 'xs', md: 'l' }}
      paddingBottom="xl"
    >
      {/* Gradient fade — content scrolls under it toward the bottom. */}
      <div className="dark:from-polar-900 dark:via-polar-900/90 pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-white via-white/90 to-transparent" />

      <Box
        position="absolute"
        display="flex"
        paddingVertical="m"
        paddingHorizontal="l"
        top={-36}
        left={{ base: 20, md: 12 }}
        right={{ base: 20, md: 12 }}
        borderTopRightRadius="l"
        borderTopLeftRadius="l"
        backgroundColor="background-card"
        maxWidth={720}
        marginHorizontal="auto"
      >
        <Link href={compassUrl}>
          <Box
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            transitionProperty="colors"
            transitionDuration="fast"
            flexDirection="row"
            alignItems="center"
            columnGap="xs"
          >
            <Text variant="caption" color="inherit">
              Introducing Polar Compass
            </Text>
            <ChevronRight size={14} />
          </Box>
        </Link>
      </Box>

      <Box position="relative" pointerEvents="auto" width="100%" maxWidth={760}>
        <CompassInputBar
          value={value}
          onValueChange={setValue}
          onSubmit={() => openCompass(value)}
          onFocus={() => openCompass()}
        />
      </Box>
    </Box>
  )
}
