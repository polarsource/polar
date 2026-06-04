// ─── Components ───────────────────────────────────────────────────────────────
export { Avatar } from './components/Avatar'
export type { AvatarProps } from './components/Avatar'
export { Button, RawButton } from './components/Button'
export type { ButtonProps } from './components/Button'
export { Input } from './components/Input'
export type { InputProps } from './components/Input'
export { SegmentedControl } from './components/SegmentedControl'
export type { SegmentedControlProps } from './components/SegmentedControl'
export { Text } from './components/Text'
export type { TextColor, TextStyleProps, TextVariant } from './components/Text'
export { Truncated } from './components/Truncated'
export type { Props as TruncatedProps } from './components/Truncated'

// ─── Tokens ───────────────────────────────────────────────────────────────────
export { animationDelays, animations } from './tokens/animations'
export type {
  AnimationDelay,
  AnimationEasing,
  AnimationName,
  AnimationProperties,
  AnimationToken,
} from './tokens/animations'

// ─── Primitives ───────────────────────────────────────────────────────────────
export { createText } from './primitives/createText'
export type {
  TextStyleProps as CreateTextStyleProps,
  TextVariant as CreateTextVariant,
} from './primitives/createText'
