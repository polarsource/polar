import { orbitTheme } from '../tokens/theme'
import { createBox } from '../primitives/createBox'

/**
 * Orbit Box — a polymorphic layout primitive whose spacing, color and radius
 * props are constrained to the Orbit design token set.
 *
 * @example
 * // Token-constrained props
 * <Box padding="spacing-3" backgroundColor="bg-surface" borderRadius="lg">…</Box>
 *
 * // Polymorphic — renders as a <section>
 * <Box as="section" padding="spacing-6" gap="spacing-4" className="flex flex-col">…</Box>
 *
 * // Escape hatches for anything not in the token set
 * <Box className="grid grid-cols-3" style={{ aspectRatio: '16/9' }}>…</Box>
 */
export const Box = createBox(orbitTheme)
export type { BoxProps } from '../primitives/createBox'
