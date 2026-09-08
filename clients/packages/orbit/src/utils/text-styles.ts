// Text / typography atomic style maps — pure CSS prop→style maps, peer of
// box-styles.ts. `textAlignStyles` is shared by Box's `textAlign` prop and
// Text's `align` prop; the rest are Text-only. None of these encode design
// decisions, so they live here rather than in the token files.

import * as stylex from '@stylexjs/stylex'

import { fontFamilies, lineHeights } from '../tokens/value.stylex'

export const textAlignStyles = stylex.create({
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
  justify: { textAlign: 'justify' },
})

export const textWrapStyles = stylex.create({
  wrap: { textWrap: 'wrap' },
  nowrap: { textWrap: 'nowrap' },
  balance: { textWrap: 'balance' },
  pretty: { textWrap: 'pretty' },
})

export const textLineHeightStyles = stylex.create({
  none: { lineHeight: lineHeights.none },
  tight: { lineHeight: lineHeights.tight },
  snug: { lineHeight: lineHeights.snug },
  normal: { lineHeight: lineHeights.normal },
  relaxed: { lineHeight: lineHeights.relaxed },
})

export const textUtilityStyles = stylex.create({
  monospace: { fontFamily: fontFamilies.mono },
  tabularNums: { fontVariantNumeric: 'tabular-nums' },
  lineThrough: { textDecoration: 'line-through' },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})
