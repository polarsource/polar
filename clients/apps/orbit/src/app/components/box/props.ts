import { type PropRow } from '@/components/docs'

export const boxProps: PropRow[] = [
  {
    name: 'as',
    type: "'div' | 'span' | 'section' | 'nav' | 'ul' | 'li' | …",
    default: "'div'",
    description:
      'Underlying element. div|span|section|article|aside|main|nav|header|footer|form|fieldset|label|ul|ol|li. DOM props for the chosen element are typed and forwarded.',
  },
  {
    name: 'className',
    type: 'string',
    description:
      'Escape hatch for concerns outside the design system. Do not use it for properties that have a typed prop.',
  },
  {
    name: 'style',
    type: 'CSSProperties',
    description: 'Inline style escape hatch, merged last over resolved styles.',
  },
  {
    name: 'display',
    type: "'flex' | 'grid' | 'block' | 'inline' | 'none' | …",
    default: "'flex'",
    description:
      'Defaults to flex for block-level elements. span/label/li keep their native display.',
  },
  {
    name: 'flexDirection',
    type: "'row' | 'column' | 'row-reverse' | 'column-reverse'",
  },
  {
    name: 'alignItems',
    type: "'start' | 'end' | 'center' | 'baseline' | 'stretch'",
  },
  {
    name: 'justifyContent',
    type: "'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'",
  },
  { name: 'flexWrap', type: "'wrap' | 'nowrap' | 'wrap-reverse'" },
  { name: 'flex', type: 'number | string' },
  {
    name: 'gap',
    type: 'SpacingToken',
    description:
      'Also rowGap and columnGap. Tokens: none|xs|s|m|l|xl|2xl|3xl|4xl|5xl.',
  },
  {
    name: 'padding',
    type: 'SpacingToken',
    description:
      'Plus paddingTop/Right/Bottom/Left, paddingHorizontal/Vertical and aliases p/px/py.',
  },
  {
    name: 'margin',
    type: "SpacingToken | 'auto'",
    description:
      'Plus per-side and axis variants and aliases m/mx/my. Accepts auto.',
  },
  {
    name: 'backgroundColor',
    type: 'BackgroundColorToken',
    description:
      'background-primary | background-secondary | background-card | background-inverse | background-warning | background-success | background-danger.',
  },
  {
    name: 'color',
    type: 'TextColorToken',
    description:
      'text-primary | text-secondary | text-tertiary | text-success | text-danger | text-warning.',
  },
  {
    name: 'borderColor',
    type: 'BorderColorToken',
    description: 'border-primary | border-secondary | border-warning.',
  },
  {
    name: 'borderRadius',
    type: 'BorderRadiusToken',
    default: "'none'",
    description: 'none | s | m | l | xl | full. Plus per-corner variants.',
  },
  {
    name: 'borderWidth',
    type: 'number',
    description: 'In px. Plus per-side variants.',
  },
  { name: 'borderStyle', type: "'solid' | 'dashed' | 'dotted' | 'none'" },
  {
    name: 'boxShadow',
    type: 'ShadowToken',
    description: 'none | s | m | l | xl.',
  },
  {
    name: 'width',
    type: 'string | number',
    description:
      'Numbers resolve to px. Also height, min/max width and height.',
  },
  { name: 'overflow', type: "'hidden' | 'auto' | 'scroll' | 'visible'" },
  { name: 'aspectRatio', type: 'string', description: "e.g. '16 / 9'." },
  {
    name: 'position',
    type: "'relative' | 'absolute' | 'fixed' | 'sticky' | 'static'",
  },
  {
    name: 'top',
    type: 'string | number',
    description: 'Also right, bottom, left, inset and zIndex.',
  },
  {
    name: 'transitionProperty',
    type: "'none' | 'all' | 'common' | 'colors' | 'opacity' | 'shadow' | 'transform'",
    description: 'Keywords expand to real property lists.',
  },
  {
    name: 'transitionDuration',
    type: 'DurationToken',
    description: 'instant | fast | base | slow | slower.',
  },
  {
    name: 'ease',
    type: 'EasingToken',
    description:
      'Alias for transitionTimingFunction. standard | decelerate | accelerate | spring.',
  },
  {
    name: 'transform',
    type: 'string',
    description: "e.g. 'translateY(-2px)'.",
  },
  {
    name: 'opacity',
    type: 'number',
    description:
      'Visual props also include cursor, pointerEvents, userSelect, textAlign.',
  },
]
