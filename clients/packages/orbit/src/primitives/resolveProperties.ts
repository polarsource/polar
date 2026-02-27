// ─── Layout types ─────────────────────────────────────────────────────────────

export type Breakpoint = 'default' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>

export type FlexContainerProps = {
  display?: Responsive<
    'flex' | 'block' | 'inline-flex' | 'grid' | 'inline-grid' | 'hidden'
  >
  flexDirection?: Responsive<
    'row' | 'column' | 'row-reverse' | 'column-reverse'
  >
  alignItems?: Responsive<'start' | 'end' | 'center' | 'stretch' | 'baseline'>
  justifyContent?: Responsive<
    'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  >
  flexWrap?: Responsive<'wrap' | 'nowrap' | 'wrap-reverse'>
}

export type FlexChildProps = {
  flex?: Responsive<'1' | 'auto' | 'none' | 'initial'>
  alignSelf?: Responsive<
    'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline'
  >
  flexGrow?: '0' | '1'
  flexShrink?: '0' | '1'
}

// ─── Shared helper ────────────────────────────────────────────────────────────
// Never concatenate prefix + class — always look up from pre-built tables.
// Tailwind JIT can scan this file and compile every literal string it finds.

export function resolveFlexProp<V extends string>(
  value: V | Partial<Record<Breakpoint, V>> | undefined,
  map: Record<Breakpoint, Record<V, string>>,
): string[] {
  if (value === undefined) return []
  if (typeof value === 'object') {
    const result: string[] = []
    for (const [bp, v] of Object.entries(value) as [Breakpoint, V][]) {
      if (v !== undefined) result.push(map[bp][v])
    }
    return result
  }
  return [map.default[value]]
}

// ─── Flex container maps ──────────────────────────────────────────────────────
// Used by resolveContainerClasses (Stack). All breakpoint variants are fully
// static string literals — no runtime string concatenation anywhere.

const DISPLAY = {
  default: {
    flex: 'flex',
    block: 'block',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    'inline-grid': 'inline-grid',
    hidden: 'hidden',
  },
  sm: {
    flex: 'sm:flex',
    block: 'sm:block',
    'inline-flex': 'sm:inline-flex',
    grid: 'sm:grid',
    'inline-grid': 'sm:inline-grid',
    hidden: 'sm:hidden',
  },
  md: {
    flex: 'md:flex',
    block: 'md:block',
    'inline-flex': 'md:inline-flex',
    grid: 'md:grid',
    'inline-grid': 'md:inline-grid',
    hidden: 'md:hidden',
  },
  lg: {
    flex: 'lg:flex',
    block: 'lg:block',
    'inline-flex': 'lg:inline-flex',
    grid: 'lg:grid',
    'inline-grid': 'lg:inline-grid',
    hidden: 'lg:hidden',
  },
  xl: {
    flex: 'xl:flex',
    block: 'xl:block',
    'inline-flex': 'xl:inline-flex',
    grid: 'xl:grid',
    'inline-grid': 'xl:inline-grid',
    hidden: 'xl:hidden',
  },
  '2xl': {
    flex: '2xl:flex',
    block: '2xl:block',
    'inline-flex': '2xl:inline-flex',
    grid: '2xl:grid',
    'inline-grid': '2xl:inline-grid',
    hidden: '2xl:hidden',
  },
} as const

const FLEX_DIRECTION = {
  default: {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse',
  },
  sm: {
    row: 'sm:flex-row',
    column: 'sm:flex-col',
    'row-reverse': 'sm:flex-row-reverse',
    'column-reverse': 'sm:flex-col-reverse',
  },
  md: {
    row: 'md:flex-row',
    column: 'md:flex-col',
    'row-reverse': 'md:flex-row-reverse',
    'column-reverse': 'md:flex-col-reverse',
  },
  lg: {
    row: 'lg:flex-row',
    column: 'lg:flex-col',
    'row-reverse': 'lg:flex-row-reverse',
    'column-reverse': 'lg:flex-col-reverse',
  },
  xl: {
    row: 'xl:flex-row',
    column: 'xl:flex-col',
    'row-reverse': 'xl:flex-row-reverse',
    'column-reverse': 'xl:flex-col-reverse',
  },
  '2xl': {
    row: '2xl:flex-row',
    column: '2xl:flex-col',
    'row-reverse': '2xl:flex-row-reverse',
    'column-reverse': '2xl:flex-col-reverse',
  },
} as const

const ALIGN_ITEMS = {
  default: {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  },
  sm: {
    start: 'sm:items-start',
    end: 'sm:items-end',
    center: 'sm:items-center',
    stretch: 'sm:items-stretch',
    baseline: 'sm:items-baseline',
  },
  md: {
    start: 'md:items-start',
    end: 'md:items-end',
    center: 'md:items-center',
    stretch: 'md:items-stretch',
    baseline: 'md:items-baseline',
  },
  lg: {
    start: 'lg:items-start',
    end: 'lg:items-end',
    center: 'lg:items-center',
    stretch: 'lg:items-stretch',
    baseline: 'lg:items-baseline',
  },
  xl: {
    start: 'xl:items-start',
    end: 'xl:items-end',
    center: 'xl:items-center',
    stretch: 'xl:items-stretch',
    baseline: 'xl:items-baseline',
  },
  '2xl': {
    start: '2xl:items-start',
    end: '2xl:items-end',
    center: '2xl:items-center',
    stretch: '2xl:items-stretch',
    baseline: '2xl:items-baseline',
  },
} as const

const JUSTIFY_CONTENT = {
  default: {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  },
  sm: {
    start: 'sm:justify-start',
    end: 'sm:justify-end',
    center: 'sm:justify-center',
    between: 'sm:justify-between',
    around: 'sm:justify-around',
    evenly: 'sm:justify-evenly',
  },
  md: {
    start: 'md:justify-start',
    end: 'md:justify-end',
    center: 'md:justify-center',
    between: 'md:justify-between',
    around: 'md:justify-around',
    evenly: 'md:justify-evenly',
  },
  lg: {
    start: 'lg:justify-start',
    end: 'lg:justify-end',
    center: 'lg:justify-center',
    between: 'lg:justify-between',
    around: 'lg:justify-around',
    evenly: 'lg:justify-evenly',
  },
  xl: {
    start: 'xl:justify-start',
    end: 'xl:justify-end',
    center: 'xl:justify-center',
    between: 'xl:justify-between',
    around: 'xl:justify-around',
    evenly: 'xl:justify-evenly',
  },
  '2xl': {
    start: '2xl:justify-start',
    end: '2xl:justify-end',
    center: '2xl:justify-center',
    between: '2xl:justify-between',
    around: '2xl:justify-around',
    evenly: '2xl:justify-evenly',
  },
} as const

const FLEX_WRAP = {
  default: {
    wrap: 'flex-wrap',
    nowrap: 'flex-nowrap',
    'wrap-reverse': 'flex-wrap-reverse',
  },
  sm: {
    wrap: 'sm:flex-wrap',
    nowrap: 'sm:flex-nowrap',
    'wrap-reverse': 'sm:flex-wrap-reverse',
  },
  md: {
    wrap: 'md:flex-wrap',
    nowrap: 'md:flex-nowrap',
    'wrap-reverse': 'md:flex-wrap-reverse',
  },
  lg: {
    wrap: 'lg:flex-wrap',
    nowrap: 'lg:flex-nowrap',
    'wrap-reverse': 'lg:flex-wrap-reverse',
  },
  xl: {
    wrap: 'xl:flex-wrap',
    nowrap: 'xl:flex-nowrap',
    'wrap-reverse': 'xl:flex-wrap-reverse',
  },
  '2xl': {
    wrap: '2xl:flex-wrap',
    nowrap: '2xl:flex-nowrap',
    'wrap-reverse': '2xl:flex-wrap-reverse',
  },
} as const

// ─── Flex child maps ──────────────────────────────────────────────────────────
// Used by resolveFlexChildClasses (Box). Props useful when Box is a flex/grid child.

const FLEX = {
  default: {
    '1': 'flex-1',
    auto: 'flex-auto',
    none: 'flex-none',
    initial: 'flex-initial',
  },
  sm: {
    '1': 'sm:flex-1',
    auto: 'sm:flex-auto',
    none: 'sm:flex-none',
    initial: 'sm:flex-initial',
  },
  md: {
    '1': 'md:flex-1',
    auto: 'md:flex-auto',
    none: 'md:flex-none',
    initial: 'md:flex-initial',
  },
  lg: {
    '1': 'lg:flex-1',
    auto: 'lg:flex-auto',
    none: 'lg:flex-none',
    initial: 'lg:flex-initial',
  },
  xl: {
    '1': 'xl:flex-1',
    auto: 'xl:flex-auto',
    none: 'xl:flex-none',
    initial: 'xl:flex-initial',
  },
  '2xl': {
    '1': '2xl:flex-1',
    auto: '2xl:flex-auto',
    none: '2xl:flex-none',
    initial: '2xl:flex-initial',
  },
} as const

const ALIGN_SELF = {
  default: {
    auto: 'self-auto',
    start: 'self-start',
    end: 'self-end',
    center: 'self-center',
    stretch: 'self-stretch',
    baseline: 'self-baseline',
  },
  sm: {
    auto: 'sm:self-auto',
    start: 'sm:self-start',
    end: 'sm:self-end',
    center: 'sm:self-center',
    stretch: 'sm:self-stretch',
    baseline: 'sm:self-baseline',
  },
  md: {
    auto: 'md:self-auto',
    start: 'md:self-start',
    end: 'md:self-end',
    center: 'md:self-center',
    stretch: 'md:self-stretch',
    baseline: 'md:self-baseline',
  },
  lg: {
    auto: 'lg:self-auto',
    start: 'lg:self-start',
    end: 'lg:self-end',
    center: 'lg:self-center',
    stretch: 'lg:self-stretch',
    baseline: 'lg:self-baseline',
  },
  xl: {
    auto: 'xl:self-auto',
    start: 'xl:self-start',
    end: 'xl:self-end',
    center: 'xl:self-center',
    stretch: 'xl:self-stretch',
    baseline: 'xl:self-baseline',
  },
  '2xl': {
    auto: '2xl:self-auto',
    start: '2xl:self-start',
    end: '2xl:self-end',
    center: '2xl:self-center',
    stretch: '2xl:self-stretch',
    baseline: '2xl:self-baseline',
  },
} as const

const FLEX_GROW: Record<NonNullable<FlexChildProps['flexGrow']>, string> = {
  '0': 'grow-0',
  '1': 'grow',
}

const FLEX_SHRINK: Record<NonNullable<FlexChildProps['flexShrink']>, string> = {
  '0': 'shrink-0',
  '1': 'shrink',
}

// ─── resolveContainerClasses ──────────────────────────────────────────────────
// Used by Stack to resolve all flex container props to Tailwind classes.

export function resolveContainerClasses(props: FlexContainerProps): string {
  const classes: string[] = []
  classes.push(...resolveFlexProp(props.display, DISPLAY))
  classes.push(...resolveFlexProp(props.flexDirection, FLEX_DIRECTION))
  classes.push(...resolveFlexProp(props.alignItems, ALIGN_ITEMS))
  classes.push(...resolveFlexProp(props.justifyContent, JUSTIFY_CONTENT))
  classes.push(...resolveFlexProp(props.flexWrap, FLEX_WRAP))
  return classes.filter(Boolean).join(' ')
}

// ─── resolveFlexChildClasses ──────────────────────────────────────────────────
// Used by Box to resolve flex child props to Tailwind classes.

export function resolveFlexChildClasses(props: FlexChildProps): string {
  const classes: string[] = []
  classes.push(...resolveFlexProp(props.flex, FLEX))
  classes.push(...resolveFlexProp(props.alignSelf, ALIGN_SELF))
  if (props.flexGrow !== undefined) classes.push(FLEX_GROW[props.flexGrow])
  if (props.flexShrink !== undefined)
    classes.push(FLEX_SHRINK[props.flexShrink])
  return classes.filter(Boolean).join(' ')
}
