'use client'

import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import CropFreeRounded from '@mui/icons-material/CropFreeRounded'
import { Box } from '@polar-sh/orbit/Box'
import { forwardRef } from 'react'

interface CompassInputBarProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit?: () => void
  onFocus?: () => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * THE Compass chat input: a rounded pill with a textarea and the
 * attach / expand / send controls. The idle bottom box and the conversation
 * overlay render this same component, so the surface cannot drift between
 * the two again.
 */
export const CompassInputBar = forwardRef<
  HTMLTextAreaElement,
  CompassInputBarProps
>(function CompassInputBar(
  {
    value,
    onValueChange,
    onSubmit,
    onFocus,
    placeholder = 'Ask Compass...',
    autoFocus,
  },
  ref,
) {
  const canSend = value.trim().length > 0

  return (
    <Box
      width="100%"
      display="flex"
      flexDirection="row"
      columnGap="l"
      paddingVertical="m"
      paddingLeft="l"
      paddingRight="m"
      borderRadius="full"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      boxShadow="xl"
    >
      <textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canSend) onSubmit?.()
          }
        }}
        rows={1}
        aria-label={placeholder}
        placeholder={placeholder}
        className="dark:text-polar-50 dark:placeholder:text-polar-500 dark:caret-polar-50 z-10 w-full resize-none border-0 bg-transparent px-1 text-sm text-gray-900 caret-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
      />

      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
      >
        <Box display="flex" alignItems="center" columnGap="s">
          {/* Planned affordances, not wired up yet: disabled so they aren't
              focusable controls that do nothing. */}
          <button
            type="button"
            aria-label="Expand (coming soon)"
            disabled
            className="dark:text-polar-500 flex size-9 cursor-not-allowed items-center justify-center rounded-full text-gray-400 opacity-60"
          >
            <CropFreeRounded style={{ fontSize: '1.125rem' }} />
          </button>
          <button
            type="button"
            aria-label="Attach (coming soon)"
            disabled
            className="dark:text-polar-500 flex size-9 cursor-not-allowed items-center justify-center rounded-full text-gray-400 opacity-60"
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
