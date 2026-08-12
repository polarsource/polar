import type { PropsWithChildren, ReactNode } from 'react'
import { Box } from './Box'
import { Text } from './Text'

export interface SubnavProps extends PropsWithChildren {
  /** Accessible name for the navigation landmark. */
  label?: string
}

/**
 * A horizontal row of links for switching between the sections of a page.
 * Compose with `SubnavItem`, passing your router's link element as the child.
 */
export const Subnav = ({ label = 'Secondary', children }: SubnavProps) => (
  <Box as="nav" aria-label={label}>
    <Box as="ul" alignItems="end" columnGap="xl" flexWrap="wrap" rowGap="s">
      {children}
    </Box>
  </Box>
)

export interface SubnavItemProps {
  /** Marks the item as the section currently shown (sets `aria-current`). */
  active?: boolean
  /** The link element for the section; color and typography are inherited. */
  children: ReactNode
}

export const SubnavItem = ({ active, children }: SubnavItemProps) => (
  <Box
    as="li"
    aria-current={active ? 'page' : undefined}
    flexDirection="column"
    alignItems="center"
    rowGap="s"
    display="flex"
    color={
      active
        ? 'text-primary'
        : { base: 'text-secondary', hover: 'text-primary' }
    }
    transitionProperty="colors"
    transitionDuration="fast"
  >
    <Text as="span" variant="heading-xxs" color="inherit">
      {children}
    </Text>
  </Box>
)
