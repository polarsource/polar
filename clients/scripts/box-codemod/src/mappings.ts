import type { ElementReport, ParsedClass } from './types.ts'
import { snapRadius, snapSpacing, TW_RADIUS_PX } from './snap.ts'

// Tailwind default 4px-per-unit scale.
function twUnitToPx(unit: string): number | null {
  if (unit === 'px') return 1
  const n = Number(unit)
  if (Number.isFinite(n)) return n * 4
  return null
}

function arbitraryPx(value: string): number | null {
  // value like "[10px]", "[1.5rem]"
  const m = value.match(/^\[(-?\d*\.?\d+)(px|rem|em)?\]$/)
  if (!m) return null
  const num = Number(m[1])
  if (!Number.isFinite(num)) return null
  const unit = m[2] || 'px'
  if (unit === 'px') return num
  if (unit === 'rem' || unit === 'em') return num * 16
  return null
}

const SPACING_PROP_PREFIXES: Record<string, string> = {
  p: 'padding',
  pt: 'paddingTop',
  pr: 'paddingRight',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  px: 'paddingHorizontal',
  py: 'paddingVertical',
  m: 'margin',
  mt: 'marginTop',
  mr: 'marginRight',
  mb: 'marginBottom',
  ml: 'marginLeft',
  mx: 'marginHorizontal',
  my: 'marginVertical',
  gap: 'gap',
  'gap-x': 'columnGap',
  'gap-y': 'rowGap',
}

const DISPLAY_MAP: Record<string, string> = {
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  hidden: 'none',
  contents: 'contents',
}

const FLEX_DIR_MAP: Record<string, string> = {
  'flex-row': 'row',
  'flex-row-reverse': 'row-reverse',
  'flex-col': 'column',
  'flex-col-reverse': 'column-reverse',
}

const FLEX_WRAP_MAP: Record<string, string> = {
  'flex-wrap': 'wrap',
  'flex-nowrap': 'nowrap',
  'flex-wrap-reverse': 'wrap-reverse',
}

const ALIGN_ITEMS: Record<string, string> = {
  'items-start': 'start',
  'items-end': 'end',
  'items-center': 'center',
  'items-baseline': 'baseline',
  'items-stretch': 'stretch',
}

const JUSTIFY: Record<string, string> = {
  'justify-start': 'start',
  'justify-end': 'end',
  'justify-center': 'center',
  'justify-between': 'between',
  'justify-around': 'around',
  'justify-evenly': 'evenly',
}

const ALIGN_SELF: Record<string, string> = {
  'self-auto': 'auto',
  'self-start': 'start',
  'self-end': 'end',
  'self-center': 'center',
  'self-stretch': 'stretch',
  'self-baseline': 'baseline',
}

// Tailwind shadow scale → Box boxShadow token (none|s|m|l|xl).
// `shadow` (no suffix) and `shadow-md` both map to `m`.
const SHADOW_MAP: Record<string, string> = {
  'shadow-none': 'none',
  'shadow-xs': 's',
  'shadow-sm': 's',
  shadow: 'm',
  'shadow-md': 'm',
  'shadow-lg': 'l',
  'shadow-xl': 'xl',
  'shadow-2xl': 'xl',
  'shadow-3xl': 'xl',
}

const POSITION: Record<string, string> = {
  static: 'static',
  relative: 'relative',
  absolute: 'absolute',
  fixed: 'fixed',
  sticky: 'sticky',
}

const OVERFLOW: Record<string, string> = {
  'overflow-hidden': 'hidden',
  'overflow-auto': 'auto',
  'overflow-scroll': 'scroll',
  'overflow-visible': 'visible',
}

const TEXT_ALIGN: Record<string, string> = {
  'text-left': 'left',
  'text-center': 'center',
  'text-right': 'right',
  'text-justify': 'justify',
}

const CURSOR: Record<string, string> = {
  'cursor-pointer': 'pointer',
  'cursor-default': 'default',
  'cursor-not-allowed': 'not-allowed',
  'cursor-text': 'text',
  'cursor-move': 'move',
  'cursor-wait': 'wait',
  'cursor-grab': 'grab',
  'cursor-grabbing': 'grabbing',
}

const POINTER: Record<string, string> = {
  'pointer-events-none': 'none',
  'pointer-events-auto': 'auto',
}

const USER_SELECT: Record<string, string> = {
  'select-none': 'none',
  'select-text': 'text',
  'select-all': 'all',
  'select-auto': 'auto',
}

const COLOR_PAIRS: Record<string, Record<string, string>> = {
  backgroundColor: {
    'bg-white|dark:bg-polar-950': 'background-primary',
    'bg-white|dark:bg-polar-900': 'background-primary',
    'bg-gray-50|dark:bg-polar-900': 'background-secondary',
    'bg-white|dark:bg-polar-800': 'background-card',
  },
  color: {
    'text-gray-900|dark:text-white': 'text-primary',
    'text-gray-500|dark:text-polar-400': 'text-secondary',
    'text-gray-400|dark:text-polar-500': 'text-tertiary',
  },
  borderColor: {
    'border-gray-200|dark:border-polar-700': 'border-primary',
  },
}

export interface MapResult {
  prop: string
  bp?: 'sm' | 'md' | 'lg' | 'xl'
  state?: 'hover' | 'focus' | 'active' | 'focusVisible' | 'focusWithin'
  value: unknown
}

const STATE_MAP: Record<string, MapResult['state']> = {
  hover: 'hover',
  focus: 'focus',
  active: 'active',
  'focus-visible': 'focusVisible',
  'focus-within': 'focusWithin',
}

export function mapSingle(
  parsed: ParsedClass,
  report: ElementReport,
): MapResult[] | null {
  if (parsed.important) return null
  const mods = parsed.modifiers.filter((m) => m !== 'dark')
  let bp: MapResult['bp'] | undefined
  let state: MapResult['state'] | undefined
  for (const m of mods) {
    if (m === 'sm' || m === 'md' || m === 'lg' || m === 'xl') {
      if (bp) return null
      bp = m
    } else if (STATE_MAP[m]) {
      if (state) return null
      state = STATE_MAP[m]
    } else {
      return null
    }
  }

  const v = mapUtility(parsed.utility, report)
  if (!v || v.length === 0) return null
  return v.map((m) => ({ ...m, bp, state }))
}

type RawMap = { prop: string; value: unknown }

function one(prop: string, value: unknown): RawMap[] {
  return [{ prop, value }]
}

function mapUtility(utility: string, report: ElementReport): RawMap[] | null {
  // Spacing: p-4, pt-2, px-[10px], gap-x-3
  // NOTE: longest prefixes first so `gap-y-12` doesn't get matched as `gap` + `y-12`
  const spaceMatch = utility.match(
    /^(gap-x|gap-y|gap|px|py|pt|pr|pb|pl|p|mx|my|mt|mr|mb|ml|m)-(.+)$/,
  )
  if (spaceMatch) {
    const prefix = spaceMatch[1]
    const value = spaceMatch[2]
    const prop = SPACING_PROP_PREFIXES[prefix]
    if (!prop) return null
    // 'auto' is valid for margin* but not padding/gap
    if (value === 'auto') {
      if (prop.startsWith('margin')) return one(prop, 'auto')
      return null
    }
    let px: number | null = null
    if (value.startsWith('[')) px = arbitraryPx(value)
    else px = twUnitToPx(value)
    if (px === null) return null
    const snap = snapSpacing(px)
    // If the drift is large in both absolute and relative terms, it's not a
    // good fit for any token. Leave the class in className so the human can
    // decide (and flag for review).
    if (snap.drift > 8 && snap.drift / Math.max(px, 1) > 0.15) {
      report.ambiguous = report.ambiguous ?? []
      report.ambiguous.push(
        `${utility} — no close spacing token (closest ${snap.token}, drift ${snap.drift}px); left in className`,
      )
      return null
    }
    if (snap.ambiguous && snap.drift > 0) {
      report.ambiguous = report.ambiguous ?? []
      report.ambiguous.push(
        `${utility} (snapped to ${snap.token}, drift ${snap.drift}px)`,
      )
    }
    return one(prop, snap.token)
  }

  // Display
  if (DISPLAY_MAP[utility]) return one('display', DISPLAY_MAP[utility])
  // Flex direction & wrap
  if (FLEX_DIR_MAP[utility]) return one('flexDirection', FLEX_DIR_MAP[utility])
  if (FLEX_WRAP_MAP[utility]) return one('flexWrap', FLEX_WRAP_MAP[utility])
  if (ALIGN_ITEMS[utility]) return one('alignItems', ALIGN_ITEMS[utility])
  if (ALIGN_SELF[utility]) return one('alignSelf', ALIGN_SELF[utility])
  if (JUSTIFY[utility]) return one('justifyContent', JUSTIFY[utility])
  if (SHADOW_MAP[utility]) return one('boxShadow', SHADOW_MAP[utility])
  if (POSITION[utility]) return one('position', POSITION[utility])
  if (OVERFLOW[utility]) return one('overflow', OVERFLOW[utility])
  if (TEXT_ALIGN[utility]) return one('textAlign', TEXT_ALIGN[utility])
  if (CURSOR[utility]) return one('cursor', CURSOR[utility])
  if (POINTER[utility]) return one('pointerEvents', POINTER[utility])
  if (USER_SELECT[utility]) return one('userSelect', USER_SELECT[utility])
  if (utility === 'overflow-x-hidden') return one('overflowX', 'hidden')
  if (utility === 'overflow-x-auto') return one('overflowX', 'auto')
  if (utility === 'overflow-y-hidden') return one('overflowY', 'hidden')
  if (utility === 'overflow-y-auto') return one('overflowY', 'auto')

  // Border radius: rounded-* and rounded, and per-corner rounded-{t,r,b,l,tl,tr,bl,br}-*
  const cornerRound = utility.match(/^rounded-(t|r|b|l|tl|tr|bl|br)(?:-(.+))?$/)
  if (cornerRound) {
    const corner = cornerRound[1]
    const key = cornerRound[2] ?? ''
    const token = roundKeyToToken(key)
    if (token === null) return null
    if (corner === 't')
      return [
        { prop: 'borderTopLeftRadius', value: token },
        { prop: 'borderTopRightRadius', value: token },
      ]
    if (corner === 'b')
      return [
        { prop: 'borderBottomLeftRadius', value: token },
        { prop: 'borderBottomRightRadius', value: token },
      ]
    if (corner === 'l')
      return [
        { prop: 'borderTopLeftRadius', value: token },
        { prop: 'borderBottomLeftRadius', value: token },
      ]
    if (corner === 'r')
      return [
        { prop: 'borderTopRightRadius', value: token },
        { prop: 'borderBottomRightRadius', value: token },
      ]
    const cornerProp = {
      tl: 'borderTopLeftRadius',
      tr: 'borderTopRightRadius',
      bl: 'borderBottomLeftRadius',
      br: 'borderBottomRightRadius',
    }[corner]!
    return one(cornerProp, token)
  }
  const roundMatch = utility.match(/^rounded(?:-(.+))?$/)
  if (roundMatch) {
    const token = roundKeyToToken(roundMatch[1] ?? '')
    if (token === null) return null
    return one('borderRadius', token)
  }

  // Border width: border, border-N, border-t/r/b/l[-N], border-x/y[-N]
  if (utility === 'border') return one('borderWidth', 1)
  const bwMatch = utility.match(/^border-(\d+)$/)
  if (bwMatch) return one('borderWidth', Number(bwMatch[1]))
  const axisMatch = utility.match(/^border-([xy])(?:-(\d+))?$/)
  if (axisMatch) {
    const w = axisMatch[2] ? Number(axisMatch[2]) : 1
    if (axisMatch[1] === 'x')
      return [
        { prop: 'borderLeftWidth', value: w },
        { prop: 'borderRightWidth', value: w },
      ]
    return [
      { prop: 'borderTopWidth', value: w },
      { prop: 'borderBottomWidth', value: w },
    ]
  }
  const sideMatch = utility.match(/^border-([trbl])(?:-(\d+))?$/)
  if (sideMatch) {
    const sideProp = {
      t: 'borderTopWidth',
      r: 'borderRightWidth',
      b: 'borderBottomWidth',
      l: 'borderLeftWidth',
    }[sideMatch[1]]!
    return one(sideProp, sideMatch[2] ? Number(sideMatch[2]) : 1)
  }

  // Flex grow/shrink and flex-1/auto/initial/none
  if (utility === 'grow') return one('flexGrow', 1)
  if (utility === 'grow-0') return one('flexGrow', 0)
  if (utility === 'shrink') return one('flexShrink', 1)
  if (utility === 'shrink-0') return one('flexShrink', 0)
  const flexNumMatch = utility.match(/^(grow|shrink)-(\d+)$/)
  if (flexNumMatch) {
    const prop = flexNumMatch[1] === 'grow' ? 'flexGrow' : 'flexShrink'
    return one(prop, Number(flexNumMatch[2]))
  }
  if (utility === 'flex-1') return one('flex', 1)
  if (utility === 'flex-auto') return one('flex', '1 1 auto')
  if (utility === 'flex-initial') return one('flex', '0 1 auto')
  if (utility === 'flex-none') return one('flex', 'none')

  // size-N: shorthand for both width and height. Must come before w-/h-.
  const sizeShortMatch = utility.match(/^size-(.+)$/)
  if (sizeShortMatch) {
    const wh = resolveSizeValue(sizeShortMatch[1], true)
    if (wh === null) return null
    return [
      { prop: 'width', value: wh },
      { prop: 'height', value: wh },
    ]
  }

  // Sizing: w/h/min-w/min-h/max-w/max-h
  const sizeMatch = utility.match(/^(min-w|max-w|min-h|max-h|w|h)-(.+)$/)
  if (sizeMatch) {
    const prop = sizingProp(sizeMatch[1])
    const v = sizeMatch[2]
    if (v === 'full') return one(prop, '100%')
    if (v === 'screen') return one(prop, isWidth(prop) ? '100vw' : '100vh')
    if (v === 'auto') return one(prop, 'auto')
    if (v === 'fit') return one(prop, 'fit-content')
    if (v === 'min') return one(prop, 'min-content')
    if (v === 'max') return one(prop, 'max-content')
    if (v.startsWith('[')) {
      const m = v.match(/^\[(.+)\]$/)
      if (m) return one(prop, m[1])
      return null
    }
    const aliasPx = TW_SIZE_ALIAS_PX[v]
    if (aliasPx !== undefined) return one(prop, `${aliasPx}px`)
    const fracMatch = v.match(/^(\d+)\/(\d+)$/)
    if (fracMatch) {
      const pct = (Number(fracMatch[1]) / Number(fracMatch[2])) * 100
      return one(prop, `${pct}%`)
    }
    const px = twUnitToPx(v)
    if (px === null) return null
    return one(prop, px)
  }

  // Grid: grid-cols-N, grid-rows-N (Tailwind = repeat(N, minmax(0, 1fr)))
  const gridColsMatch = utility.match(/^grid-cols-(\d+)$/)
  if (gridColsMatch) {
    const n = Number(gridColsMatch[1])
    return one('gridTemplateColumns', `repeat(${n}, minmax(0, 1fr))`)
  }
  const gridRowsMatch = utility.match(/^grid-rows-(\d+)$/)
  if (gridRowsMatch) {
    const n = Number(gridRowsMatch[1])
    return one('gridTemplateRows', `repeat(${n}, minmax(0, 1fr))`)
  }
  const colSpanMatch = utility.match(/^col-span-(\d+|full)$/)
  if (colSpanMatch) {
    const v = colSpanMatch[1]
    if (v === 'full') return one('gridColumn', '1 / -1')
    return one('gridColumn', `span ${v} / span ${v}`)
  }
  const rowSpanMatch = utility.match(/^row-span-(\d+|full)$/)
  if (rowSpanMatch) {
    const v = rowSpanMatch[1]
    if (v === 'full') return one('gridRow', '1 / -1')
    return one('gridRow', `span ${v} / span ${v}`)
  }

  // Position offsets: top-N, right-N, bottom-N, left-N, inset-N, inset-x-N, inset-y-N
  // (also negative variants like -top-3)
  const posMatch = utility.match(
    /^(-?)(top|right|bottom|left|inset|inset-x|inset-y)-(.+)$/,
  )
  if (posMatch) {
    const negative = posMatch[1] === '-'
    const v = posMatch[3]
    const value = positionValue(v, negative)
    if (value === null) return null
    if (posMatch[2] === 'inset-x')
      return [
        { prop: 'left', value },
        { prop: 'right', value },
      ]
    if (posMatch[2] === 'inset-y')
      return [
        { prop: 'top', value },
        { prop: 'bottom', value },
      ]
    return one(posMatch[2], value)
  }

  // z-index: z-N
  const zMatch = utility.match(/^z-(\d+|\[.+\]|auto)$/)
  if (zMatch) {
    const v = zMatch[1]
    if (v === 'auto') return one('zIndex', 'auto')
    if (v.startsWith('[')) return one('zIndex', v.slice(1, -1))
    return one('zIndex', Number(v))
  }

  // opacity: opacity-N (Tailwind percent → 0-1)
  const opMatch = utility.match(/^opacity-(\d+|\[.+\])$/)
  if (opMatch) {
    const v = opMatch[1]
    if (v.startsWith('[')) return one('opacity', Number(v.slice(1, -1)))
    return one('opacity', Number(v) / 100)
  }

  // aspect-ratio: aspect-square, aspect-video, aspect-[N/M]
  if (utility === 'aspect-square') return one('aspectRatio', '1 / 1')
  if (utility === 'aspect-video') return one('aspectRatio', '16 / 9')
  const aspectMatch = utility.match(/^aspect-\[(.+)\]$/)
  if (aspectMatch) return one('aspectRatio', aspectMatch[1].replace(/_/g, ' '))

  return null
}

function roundKeyToToken(key: string): string | null {
  if (key === 'full') return 'full'
  if (key === 'none') return 'none'
  if (key.startsWith('[')) {
    const px = arbitraryPx(key)
    if (px === null) return null
    return snapRadius(px).token
  }
  const px = TW_RADIUS_PX[key]
  if (px === undefined) return null
  return snapRadius(px).token
}

function sizingProp(prefix: string): string {
  switch (prefix) {
    case 'w':
      return 'width'
    case 'h':
      return 'height'
    case 'min-w':
      return 'minWidth'
    case 'max-w':
      return 'maxWidth'
    case 'min-h':
      return 'minHeight'
    case 'max-h':
      return 'maxHeight'
    default:
      return 'width'
  }
}

function isWidth(prop: string): boolean {
  return prop === 'width' || prop === 'minWidth' || prop === 'maxWidth'
}

// Shared resolver for `size-X` and `(min|max)-(w|h)-X` value strings.
// `square=true` means the value applies to both width & height (no vw/vh).
function resolveSizeValue(v: string, square: boolean): string | number | null {
  if (v === 'full') return '100%'
  if (v === 'screen') return square ? null : '100vw'
  if (v === 'auto') return 'auto'
  if (v === 'fit') return 'fit-content'
  if (v === 'min') return 'min-content'
  if (v === 'max') return 'max-content'
  if (v.startsWith('[')) {
    const m = v.match(/^\[(.+)\]$/)
    return m ? m[1] : null
  }
  const fracMatch = v.match(/^(\d+)\/(\d+)$/)
  if (fracMatch) {
    const pct = (Number(fracMatch[1]) / Number(fracMatch[2])) * 100
    return `${pct}%`
  }
  return twUnitToPx(v)
}

function positionValue(v: string, negative = false): string | number | null {
  if (v === 'full') return negative ? '-100%' : '100%'
  if (v === 'auto') return 'auto'
  if (v === 'px') return negative ? -1 : 1
  if (v.startsWith('[')) {
    const m = v.match(/^\[(.+)\]$/)
    if (!m) return null
    return negative ? `-${m[1]}` : m[1]
  }
  // Fractional Tailwind values (1/2, 1/3, etc.)
  const fracMatch = v.match(/^(\d+)\/(\d+)$/)
  if (fracMatch) {
    const pct = (Number(fracMatch[1]) / Number(fracMatch[2])) * 100
    return `${negative ? -pct : pct}%`
  }
  const px = twUnitToPx(v)
  if (px === null) return null
  return negative ? -px : px
}

// Tailwind's named size scale (used by w-*, max-w-*, etc.)
const TW_SIZE_ALIAS_PX: Record<string, number> = {
  '3xs': 256,
  '2xs': 288,
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
  '5xl': 1024,
  '6xl': 1152,
  '7xl': 1280,
}

const BREAKPOINTS: MapResult['bp'][] = ['sm', 'md', 'lg', 'xl']
const STATES: MapResult['state'][] = [
  'hover',
  'focus',
  'active',
  'focusVisible',
  'focusWithin',
]
const RAW_STATE_TO_KEY: Record<string, MapResult['state']> = {
  hover: 'hover',
  focus: 'focus',
  active: 'active',
  'focus-visible': 'focusVisible',
  'focus-within': 'focusWithin',
}

interface ClassScope {
  dark: boolean
  bp?: MapResult['bp']
  state?: MapResult['state']
  ok: boolean // false if the class has any unrecognised modifier
}

function classScope(c: ParsedClass): ClassScope {
  let dark = false
  let bp: MapResult['bp'] | undefined
  let state: MapResult['state'] | undefined
  for (const m of c.modifiers) {
    if (m === 'dark') {
      dark = true
    } else if (m === 'sm' || m === 'md' || m === 'lg' || m === 'xl') {
      if (bp) return { dark, bp, state, ok: false }
      bp = m
    } else if (RAW_STATE_TO_KEY[m]) {
      if (state) return { dark, bp, state, ok: false }
      state = RAW_STATE_TO_KEY[m]
    } else {
      return { dark, bp, state, ok: false }
    }
  }
  return { dark, bp, state, ok: true }
}

export function tryColorPair(
  classes: ParsedClass[],
): { mapped: MapResult; consumed: ParsedClass[] }[] {
  const results: { mapped: MapResult; consumed: ParsedClass[] }[] = []
  const scopes: { bp?: MapResult['bp']; state?: MapResult['state'] }[] = []
  for (const bp of [undefined, ...BREAKPOINTS]) {
    for (const state of [undefined, ...STATES]) {
      scopes.push({ bp, state })
    }
  }

  for (const [prop, table] of Object.entries(COLOR_PAIRS)) {
    for (const [pair, token] of Object.entries(table)) {
      const [light, dark] = pair.split('|')
      const lightUtility = light
      const darkUtility = dark.startsWith('dark:') ? dark.slice(5) : dark

      for (const { bp, state } of scopes) {
        const matchScope = (c: ParsedClass, wantDark: boolean) => {
          const s = classScope(c)
          return s.ok && s.dark === wantDark && s.bp === bp && s.state === state
        }
        const lightHit = classes.find(
          (c) => matchScope(c, false) && c.utility === lightUtility,
        )
        const darkHit = classes.find(
          (c) => matchScope(c, true) && c.utility === darkUtility,
        )
        if (lightHit && darkHit) {
          results.push({
            mapped: { prop, value: token, bp, state },
            consumed: [lightHit, darkHit],
          })
        }
      }
    }
  }
  return results
}
