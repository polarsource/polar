'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import CropFreeRounded from '@mui/icons-material/CropFreeRounded'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined'
import { forwardRef } from 'react'

interface CompassInputBarProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * The Compass chat input surface: a rounded box with a growing textarea and the
 * skills / attach / send controls. Shared by the idle bottom box and the
 * conversation overlay so the input looks and behaves identically in both.
 */
export const CompassInputBar = forwardRef<
  HTMLTextAreaElement,
  CompassInputBarProps
>(function CompassInputBar(
  { value, onValueChange, onSubmit, placeholder = 'Ask Compass...', autoFocus },
  ref,
) {
  const canSend = value.trim().length > 0

  return (
    <Box
      pointerEvents="auto"
      width="100%"
      display="flex"
      flexDirection="row"
      columnGap="l"
      padding="l"
      borderRadius="full"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      backgroundColor="background-secondary"
      boxShadow="xl"
    >
      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canSend) onSubmit?.()
          }
        }}
        rows={1}
        placeholder={placeholder}
        className="dark:text-polar-50 dark:placeholder:text-polar-500 dark:caret-polar-50 w-full resize-none border-0 bg-transparent px-1 text-sm text-gray-900 caret-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
      />

      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
      >
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
            disabled={!canSend}
            onClick={() => onSubmit?.()}
            className="dark:bg-polar-50 flex size-9 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity disabled:opacity-40 dark:text-gray-900"
          >
            <ArrowUpwardRounded style={{ fontSize: '1.125rem' }} />
          </button>
        </Box>
      </Box>
    </Box>
  )
})
