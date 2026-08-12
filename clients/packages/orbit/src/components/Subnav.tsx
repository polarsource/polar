import type { PropsWithChildren, ReactNode } from 'react'
import { Box } from './Box'
import { Text } from './Text'

export interface SubnavProps extends PropsWithChildren {
  /**
   * Accessible name for the navigation landmark, distinguishing it from the
   * page's primary navigation for assistive technology.
   */
  label?: string
}

/**
 * A horizontal row of links for switching between the sections of a page.
 * Compose it with `SubnavItem`, passing your router's link element as the
 * item's child so client-side navigation is preserved.
 */
export const Subnav = ({ label = 'Secondary', children }: SubnavProps) => (
  <Box as="nav" aria-label={label}>
    <Box as="ul" alignItems="end" columnGap="xl" flexWrap="wrap" rowGap="s">
      {children}
    </Box>
  </Box>
)

export interface SubnavItemProps {
  /**
   * Marks the item as the section currently shown. The active item is
   * emphasised, underlined, and exposed to assistive technology via
   * `aria-current`.
   */
  active?: boolean
  /**
   * The link (or button) for the section. Styling is inherited, so any
   * anchor-like element works — a framework `<Link>`, a plain `<a>`, or a
   * `<button>` with its chrome reset.
   */
  children: ReactNode
}

// The item styles the list element and lets the link inherit color and
// typography, so it stays agnostic of which link component the consumer's
// router provides. The round indicator dot, centered under the label, is
// always rendered — transparent unless active — so activating an item never
// shifts layout.
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
