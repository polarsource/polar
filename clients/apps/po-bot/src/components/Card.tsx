import { Box, type BoxProps } from '@polar-sh/orbit/Box'

type Element = 'div' | 'section' | 'aside' | 'main' | 'form' | 'li'

/**
 * A pane: the dashboard's body surface, one of the few bordered rectangles
 * on the page. Lists, rows and stats inside it sit flat.
 */
export const Surface = <E extends Element>({
  className,
  ...props
}: BoxProps<E>) => (
  <Box
    className={['surface', className].filter(Boolean).join(' ')}
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    boxShadow="s"
    {...props}
  />
)

/** A tinted, borderless block for a node or a tile inside a surface. */
export const Tile = <E extends Element>(props: BoxProps<E>) => (
  <Box borderRadius="m" backgroundColor="background-card" {...props} />
)

/** A hairline between sections of a pane. */
export const Divider = () => (
  <Box
    role="separator"
    height={1}
    width="100%"
    flexShrink={0}
    backgroundColor="background-card"
  />
)
