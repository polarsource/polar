import { createBox } from '../primitives/createBox'

/**
 * Orbit Box — a polymorphic layout primitive.
 *
 * Style props (backgroundColor, padding, gap, borderRadius, …) accept any
 * CSS value string — typically CSS variable references from useOrbit():
 *
 * @example
 * const { spacing, card } = useOrbit()
 * <Box padding={spacing['SPACING_3']} backgroundColor={card.background}>…</Box>
 *
 * // Polymorphic — renders as a <section>
 * <Box as="section" padding="var(--spacing-SPACING_6)" flex="1">…</Box>
 *
 * // Escape hatch for anything else
 * <Box className="grid grid-cols-3" style={{ aspectRatio: '16/9' }}>…</Box>
 */
export const Box = createBox()
export type { BoxProps, BoxStyleProps } from '../primitives/createBox'
