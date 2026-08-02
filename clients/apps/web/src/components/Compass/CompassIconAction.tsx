'use client'

import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

interface CompassIconActionProps {
  label: string
  onClick: () => void
  expanded?: boolean
  children: ReactNode
}

/**
 * Icon-only header action for Compass. It stays recessive next to the routed
 * tabs, which are the page's actual navigation, and takes its label from the
 * accessible name rather than visible text.
 */
export const CompassIconAction = ({
  label,
  onClick,
  expanded,
  children,
}: CompassIconActionProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-expanded={expanded}
    aria-haspopup={expanded === undefined ? undefined : 'menu'}
    onClick={onClick}
    className="cursor-pointer transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
  >
    <Box
      as="span"
      display="inline-flex"
      width={32}
      height={32}
      borderRadius="full"
      alignItems="center"
      justifyContent="center"
      color={
        expanded
          ? { base: 'text-primary' }
          : { base: 'text-tertiary', hover: 'text-primary' }
      }
      backgroundColor={
        expanded
          ? { base: 'background-card', hover: 'background-card' }
          : { hover: 'background-card' }
      }
      transitionProperty="colors"
      transitionDuration="fast"
    >
      {children}
    </Box>
  </button>
)
