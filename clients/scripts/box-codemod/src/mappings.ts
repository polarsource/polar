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
): MapResult | null {
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
  if (!v) return null
  return { ...v, bp, state }
}

function mapUtility(
  utility: string,
  report: ElementReport,
): { prop: string; value: unknown } | null {
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
      if (prop.startsWith('margin')) return { prop, value: 'auto' }
      return null
    }
    let px: number | null = null
    if (value.startsWith('[')) px = arbitraryPx(value)
    else px = twUnitToPx(value)
    if (px === null) return null
    const snap = snapSpacing(px)
    if (snap.drift > 0 && (snap.ambiguous || snap.drift >= 2)) {
      report.ambiguous = report.ambiguous ?? []
      report.ambiguous.push(
        `${utility} (snapped to ${snap.token}, drift ${snap.drift}px)`,
      )
    }
    return { prop, value: snap.token }
  }

  // Display
  if (DISPLAY_MAP[utility]) return { prop: 'display', value: DISPLAY_MAP[utility] }
  // Flex direction & wrap
  if (FLEX_DIR_MAP[utility]) return { prop: 'flexDirection', value: FLEX_DIR_MAP[utility] }
  if (FLEX_WRAP_MAP[utility]) return { prop: 'flexWrap', value: FLEX_WRAP_MAP[utility] }
  if (ALIGN_ITEMS[utility]) return { prop: 'alignItems', value: ALIGN_ITEMS[utility] }
  if (JUSTIFY[utility]) return { prop: 'justifyContent', value: JUSTIFY[utility] }
  if (POSITION[utility]) return { prop: 'position', value: POSITION[utility] }
  if (OVERFLOW[utility]) return { prop: 'overflow', value: OVERFLOW[utility] }
  if (TEXT_ALIGN[utility]) return { prop: 'textAlign', value: TEXT_ALIGN[utility] }
  if (CURSOR[utility]) return { prop: 'cursor', value: CURSOR[utility] }
  if (POINTER[utility]) return { prop: 'pointerEvents', value: POINTER[utility] }
  if (USER_SELECT[utility]) return { prop: 'userSelect', value: USER_SELECT[utility] }
  if (utility === 'overflow-x-hidden') return { prop: 'overflowX', value: 'hidden' }
  if (utility === 'overflow-x-auto') return { prop: 'overflowX', value: 'auto' }
  if (utility === 'overflow-y-hidden') return { prop: 'overflowY', value: 'hidden' }
  if (utility === 'overflow-y-auto') return { prop: 'overflowY', value: 'auto' }

  // Border radius: rounded-* and rounded
  const roundMatch = utility.match(/^rounded(?:-(.+))?$/)
  if (roundMatch) {
    const key = roundMatch[1] ?? ''
    if (key === 'full') return { prop: 'borderRadius', value: 'full' }
    if (key.startsWith('[')) {
      const px = arbitraryPx(key)
      if (px === null) return null
      const snap = snapRadius(px)
      return { prop: 'borderRadius', value: snap.token }
    }
    const px = TW_RADIUS_PX[key]
    if (px === undefined) return null
    const snap = snapRadius(px)
    return { prop: 'borderRadius', value: snap.token }
  }

  // Border width: border, border-N, border-t, border-t-N (and r/b/l)
  if (utility === 'border') return { prop: 'borderWidth', value: 1 }
  const bwMatch = utility.match(/^border-(\d+)$/)
  if (bwMatch) return { prop: 'borderWidth', value: Number(bwMatch[1]) }
  const sideMatch = utility.match(/^border-([trbl])(?:-(\d+))?$/)
  if (sideMatch) {
    const sideProp = {
      t: 'borderTopWidth',
      r: 'borderRightWidth',
      b: 'borderBottomWidth',
      l: 'borderLeftWidth',
    }[sideMatch[1]]!
    const width = sideMatch[2] ? Number(sideMatch[2]) : 1
    return { prop: sideProp, value: width }
  }

  // Flex grow/shrink
  if (utility === 'grow') return { prop: 'flexGrow', value: 1 }
  if (utility === 'grow-0') return { prop: 'flexGrow', value: 0 }
  if (utility === 'shrink') return { prop: 'flexShrink', value: 1 }
  if (utility === 'shrink-0') return { prop: 'flexShrink', value: 0 }
  const flexNumMatch = utility.match(/^(grow|shrink)-(\d+)$/)
  if (flexNumMatch) {
    const prop = flexNumMatch[1] === 'grow' ? 'flexGrow' : 'flexShrink'
    return { prop, value: Number(flexNumMatch[2]) }
  }

  // Sizing: w-full, w-N, w-[Npx], h-..., w-screen, h-screen
  const sizeMatch = utility.match(/^([wh])-(.+)$/)
  if (sizeMatch) {
    const prop = sizeMatch[1] === 'w' ? 'width' : 'height'
    const v = sizeMatch[2]
    if (v === 'full') return { prop, value: '100%' }
    if (v === 'screen') return { prop, value: prop === 'width' ? '100vw' : '100vh' }
    if (v === 'auto') return { prop, value: 'auto' }
    if (v.startsWith('[')) {
      const m = v.match(/^\[(.+)\]$/)
      if (m) return { prop, value: m[1] }
      return null
    }
    const px = twUnitToPx(v)
    if (px === null) return null
    return { prop, value: px }
  }

  return null
}

export function tryColorPair(
  classes: ParsedClass[],
): { mapped: MapResult; consumed: ParsedClass[] }[] {
  const results: { mapped: MapResult; consumed: ParsedClass[] }[] = []
  for (const [prop, table] of Object.entries(COLOR_PAIRS)) {
    for (const [pair, token] of Object.entries(table)) {
      const [light, dark] = pair.split('|')
      const lightHit = classes.find(
        (c) => c.modifiers.length === 0 && c.raw === light,
      )
      const darkHit = classes.find(
        (c) => c.modifiers.length === 1 && c.raw === dark,
      )
      if (lightHit && darkHit) {
        results.push({
          mapped: { prop, value: token },
          consumed: [lightHit, darkHit],
        })
      }
    }
  }
  return results
}
