'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import CropFreeRounded from '@mui/icons-material/CropFreeRounded'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * Exploration: the Compass agentic chat box, pinned to the bottom of the
 * viewport on the overview. The overlay is fixed and pointer-transparent
 * except the box itself, with a gradient fading the page content out beneath
 * it.
 */
export const CompassBox = () => {
  const [value, setValue] = useState('')

  return (
    <Box
      position="sticky"
      left={0}
      right={0}
      bottom={0}
      zIndex={30}
      pointerEvents="none"
      display="flex"
      justifyContent="center"
      alignItems="end"
      paddingHorizontal="l"
      paddingBottom="xl"
    >
      {/* Gradient fade — content scrolls under it toward the bottom. */}
      <div className="dark:from-polar-900 dark:via-polar-900/85 pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-white via-white/85 to-transparent" />

      <Box
        position="absolute"
        display="flex"
        paddingVertical="m"
        paddingHorizontal="l"
        top={-36}
        left={12}
        right={12}
        borderTopRightRadius="l"
        borderTopLeftRadius="l"
        backgroundColor="background-card"
        maxWidth={720}
        marginHorizontal="auto"
      >
        <Box
          color="text-secondary"
          flexDirection="row"
          alignItems="center"
          columnGap="xs"
        >
          <Text variant="caption" color="muted">
            Introducing Polar Compass
          </Text>
          <ChevronRight size={14} />
        </Box>
      </Box>

      <Box
        position="relative"
        pointerEvents="auto"
        width="100%"
        maxWidth={760}
        display="flex"
        flexDirection="column"
        rowGap="s"
        padding="l"
        borderRadius="xl"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
        backgroundColor="background-secondary"
        boxShadow="xl"
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={1}
          placeholder="Ask Compass..."
          className="dark:text-polar-50 dark:placeholder:text-polar-500 z-10 w-full resize-none border-0 bg-transparent px-1 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
        />

        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="between"
        >
          <button
            type="button"
            className="dark:text-polar-300 dark:hover:bg-polar-700 flex items-center gap-x-1.5 rounded-full px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100"
          >
            <ViewInArOutlined style={{ fontSize: '1rem' }} />
            <Text>Skills</Text>
            <KeyboardArrowDownRounded style={{ fontSize: '1.125rem' }} />
          </button>

          <Box display="flex" alignItems="center" columnGap="s">
            <button
              type="button"
              aria-label="Expand"
              className="dark:text-polar-400 dark:hover:bg-polar-700 dark:hover:text-polar-200 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <CropFreeRounded style={{ fontSize: '1.125rem' }} />
            </button>
            <button
              type="button"
              aria-label="Attach"
              className="dark:text-polar-400 dark:hover:bg-polar-700 dark:hover:text-polar-200 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <AttachFileRounded style={{ fontSize: '1.125rem' }} />
            </button>
            <button
              type="button"
              aria-label="Send"
              disabled={value.trim().length === 0}
              className="dark:bg-polar-50 flex size-9 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity disabled:opacity-40 dark:text-gray-900"
            >
              <ArrowUpwardRounded style={{ fontSize: '1.125rem' }} />
            </button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
