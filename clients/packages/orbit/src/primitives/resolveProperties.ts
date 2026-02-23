import type {
  Breakpoint,
  ColorClasses,
  FlexChildProps,
  FlexContainerProps,
  RadiusClasses,
  SpacingClasses,
  ThemeSpec,
  TokenProps,
} from './createBox'

// ─── resolveThemeProp ─────────────────────────────────────────────────────────
// Generic helper for token props that support a responsive breakpoint map.
// For 'default', falls back to the theme (dynamic). Other breakpoints use the
// static tables below, which Tailwind JIT can scan.

function resolveThemeProp<T>(
  value: T | Partial<Record<string, T>> | undefined,
  defaultFn: (v: T) => string | undefined,
  bpFn: (bp: string, v: T) => string | undefined,
): string[] {
  if (value === undefined) return []
  if (typeof value === 'object' && value !== null) {
    const result: string[] = []
    for (const [bp, v] of Object.entries(value as Record<string, T>)) {
      if (v === undefined) continue
      const cls = bp === 'default' ? defaultFn(v) : bpFn(bp, v)
      if (cls) result.push(cls)
    }
    return result
  }
  const cls = defaultFn(value as T)
  return cls ? [cls] : []
}

// ─── Spacing breakpoint table ─────────────────────────────────────────────────
// Static prefixed class strings for sm / md / lg / xl / 2xl.
// 'default' is resolved dynamically from the theme; only non-default BPs live here.

const SPACING_BP: Record<string, Record<string, SpacingClasses>> = {
  sm: {
    'spacing-0':   { padding: 'sm:p-0',  paddingX: 'sm:px-0',  paddingY: 'sm:py-0',  paddingTop: 'sm:pt-0',  paddingRight: 'sm:pr-0',  paddingBottom: 'sm:pb-0',  paddingLeft: 'sm:pl-0',  margin: 'sm:m-0',  marginX: 'sm:mx-0',  marginY: 'sm:my-0',  marginTop: 'sm:mt-0',  marginRight: 'sm:mr-0',  marginBottom: 'sm:mb-0',  marginLeft: 'sm:ml-0',  gap: 'sm:gap-0',  rowGap: 'sm:gap-y-0',  columnGap: 'sm:gap-x-0' },
    'spacing-1':   { padding: 'sm:p-2',  paddingX: 'sm:px-2',  paddingY: 'sm:py-2',  paddingTop: 'sm:pt-2',  paddingRight: 'sm:pr-2',  paddingBottom: 'sm:pb-2',  paddingLeft: 'sm:pl-2',  margin: 'sm:m-2',  marginX: 'sm:mx-2',  marginY: 'sm:my-2',  marginTop: 'sm:mt-2',  marginRight: 'sm:mr-2',  marginBottom: 'sm:mb-2',  marginLeft: 'sm:ml-2',  gap: 'sm:gap-2',  rowGap: 'sm:gap-y-2',  columnGap: 'sm:gap-x-2' },
    'spacing-2':   { padding: 'sm:p-4',  paddingX: 'sm:px-4',  paddingY: 'sm:py-4',  paddingTop: 'sm:pt-4',  paddingRight: 'sm:pr-4',  paddingBottom: 'sm:pb-4',  paddingLeft: 'sm:pl-4',  margin: 'sm:m-4',  marginX: 'sm:mx-4',  marginY: 'sm:my-4',  marginTop: 'sm:mt-4',  marginRight: 'sm:mr-4',  marginBottom: 'sm:mb-4',  marginLeft: 'sm:ml-4',  gap: 'sm:gap-4',  rowGap: 'sm:gap-y-4',  columnGap: 'sm:gap-x-4' },
    'spacing-3':   { padding: 'sm:p-6',  paddingX: 'sm:px-6',  paddingY: 'sm:py-6',  paddingTop: 'sm:pt-6',  paddingRight: 'sm:pr-6',  paddingBottom: 'sm:pb-6',  paddingLeft: 'sm:pl-6',  margin: 'sm:m-6',  marginX: 'sm:mx-6',  marginY: 'sm:my-6',  marginTop: 'sm:mt-6',  marginRight: 'sm:mr-6',  marginBottom: 'sm:mb-6',  marginLeft: 'sm:ml-6',  gap: 'sm:gap-6',  rowGap: 'sm:gap-y-6',  columnGap: 'sm:gap-x-6' },
    'spacing-4':   { padding: 'sm:p-8',  paddingX: 'sm:px-8',  paddingY: 'sm:py-8',  paddingTop: 'sm:pt-8',  paddingRight: 'sm:pr-8',  paddingBottom: 'sm:pb-8',  paddingLeft: 'sm:pl-8',  margin: 'sm:m-8',  marginX: 'sm:mx-8',  marginY: 'sm:my-8',  marginTop: 'sm:mt-8',  marginRight: 'sm:mr-8',  marginBottom: 'sm:mb-8',  marginLeft: 'sm:ml-8',  gap: 'sm:gap-8',  rowGap: 'sm:gap-y-8',  columnGap: 'sm:gap-x-8' },
    'spacing-5':   { padding: 'sm:p-10', paddingX: 'sm:px-10', paddingY: 'sm:py-10', paddingTop: 'sm:pt-10', paddingRight: 'sm:pr-10', paddingBottom: 'sm:pb-10', paddingLeft: 'sm:pl-10', margin: 'sm:m-10', marginX: 'sm:mx-10', marginY: 'sm:my-10', marginTop: 'sm:mt-10', marginRight: 'sm:mr-10', marginBottom: 'sm:mb-10', marginLeft: 'sm:ml-10', gap: 'sm:gap-10', rowGap: 'sm:gap-y-10', columnGap: 'sm:gap-x-10' },
    'spacing-6':   { padding: 'sm:p-12', paddingX: 'sm:px-12', paddingY: 'sm:py-12', paddingTop: 'sm:pt-12', paddingRight: 'sm:pr-12', paddingBottom: 'sm:pb-12', paddingLeft: 'sm:pl-12', margin: 'sm:m-12', marginX: 'sm:mx-12', marginY: 'sm:my-12', marginTop: 'sm:mt-12', marginRight: 'sm:mr-12', marginBottom: 'sm:mb-12', marginLeft: 'sm:ml-12', gap: 'sm:gap-12', rowGap: 'sm:gap-y-12', columnGap: 'sm:gap-x-12' },
    'spacing-8':   { padding: 'sm:p-16', paddingX: 'sm:px-16', paddingY: 'sm:py-16', paddingTop: 'sm:pt-16', paddingRight: 'sm:pr-16', paddingBottom: 'sm:pb-16', paddingLeft: 'sm:pl-16', margin: 'sm:m-16', marginX: 'sm:mx-16', marginY: 'sm:my-16', marginTop: 'sm:mt-16', marginRight: 'sm:mr-16', marginBottom: 'sm:mb-16', marginLeft: 'sm:ml-16', gap: 'sm:gap-16', rowGap: 'sm:gap-y-16', columnGap: 'sm:gap-x-16' },
    'spacing-10':  { padding: 'sm:p-20', paddingX: 'sm:px-20', paddingY: 'sm:py-20', paddingTop: 'sm:pt-20', paddingRight: 'sm:pr-20', paddingBottom: 'sm:pb-20', paddingLeft: 'sm:pl-20', margin: 'sm:m-20', marginX: 'sm:mx-20', marginY: 'sm:my-20', marginTop: 'sm:mt-20', marginRight: 'sm:mr-20', marginBottom: 'sm:mb-20', marginLeft: 'sm:ml-20', gap: 'sm:gap-20', rowGap: 'sm:gap-y-20', columnGap: 'sm:gap-x-20' },
    'spacing-12':  { padding: 'sm:p-24', paddingX: 'sm:px-24', paddingY: 'sm:py-24', paddingTop: 'sm:pt-24', paddingRight: 'sm:pr-24', paddingBottom: 'sm:pb-24', paddingLeft: 'sm:pl-24', margin: 'sm:m-24', marginX: 'sm:mx-24', marginY: 'sm:my-24', marginTop: 'sm:mt-24', marginRight: 'sm:mr-24', marginBottom: 'sm:mb-24', marginLeft: 'sm:ml-24', gap: 'sm:gap-24', rowGap: 'sm:gap-y-24', columnGap: 'sm:gap-x-24' },
    'spacing-16':  { padding: 'sm:p-32', paddingX: 'sm:px-32', paddingY: 'sm:py-32', paddingTop: 'sm:pt-32', paddingRight: 'sm:pr-32', paddingBottom: 'sm:pb-32', paddingLeft: 'sm:pl-32', margin: 'sm:m-32', marginX: 'sm:mx-32', marginY: 'sm:my-32', marginTop: 'sm:mt-32', marginRight: 'sm:mr-32', marginBottom: 'sm:mb-32', marginLeft: 'sm:ml-32', gap: 'sm:gap-32', rowGap: 'sm:gap-y-32', columnGap: 'sm:gap-x-32' },
    'spacing-32':  { padding: 'sm:p-64', paddingX: 'sm:px-64', paddingY: 'sm:py-64', paddingTop: 'sm:pt-64', paddingRight: 'sm:pr-64', paddingBottom: 'sm:pb-64', paddingLeft: 'sm:pl-64', margin: 'sm:m-64', marginX: 'sm:mx-64', marginY: 'sm:my-64', marginTop: 'sm:mt-64', marginRight: 'sm:mr-64', marginBottom: 'sm:mb-64', marginLeft: 'sm:ml-64', gap: 'sm:gap-64', rowGap: 'sm:gap-y-64', columnGap: 'sm:gap-x-64' },
  },
  md: {
    'spacing-0':   { padding: 'md:p-0',  paddingX: 'md:px-0',  paddingY: 'md:py-0',  paddingTop: 'md:pt-0',  paddingRight: 'md:pr-0',  paddingBottom: 'md:pb-0',  paddingLeft: 'md:pl-0',  margin: 'md:m-0',  marginX: 'md:mx-0',  marginY: 'md:my-0',  marginTop: 'md:mt-0',  marginRight: 'md:mr-0',  marginBottom: 'md:mb-0',  marginLeft: 'md:ml-0',  gap: 'md:gap-0',  rowGap: 'md:gap-y-0',  columnGap: 'md:gap-x-0' },
    'spacing-1':   { padding: 'md:p-2',  paddingX: 'md:px-2',  paddingY: 'md:py-2',  paddingTop: 'md:pt-2',  paddingRight: 'md:pr-2',  paddingBottom: 'md:pb-2',  paddingLeft: 'md:pl-2',  margin: 'md:m-2',  marginX: 'md:mx-2',  marginY: 'md:my-2',  marginTop: 'md:mt-2',  marginRight: 'md:mr-2',  marginBottom: 'md:mb-2',  marginLeft: 'md:ml-2',  gap: 'md:gap-2',  rowGap: 'md:gap-y-2',  columnGap: 'md:gap-x-2' },
    'spacing-2':   { padding: 'md:p-4',  paddingX: 'md:px-4',  paddingY: 'md:py-4',  paddingTop: 'md:pt-4',  paddingRight: 'md:pr-4',  paddingBottom: 'md:pb-4',  paddingLeft: 'md:pl-4',  margin: 'md:m-4',  marginX: 'md:mx-4',  marginY: 'md:my-4',  marginTop: 'md:mt-4',  marginRight: 'md:mr-4',  marginBottom: 'md:mb-4',  marginLeft: 'md:ml-4',  gap: 'md:gap-4',  rowGap: 'md:gap-y-4',  columnGap: 'md:gap-x-4' },
    'spacing-3':   { padding: 'md:p-6',  paddingX: 'md:px-6',  paddingY: 'md:py-6',  paddingTop: 'md:pt-6',  paddingRight: 'md:pr-6',  paddingBottom: 'md:pb-6',  paddingLeft: 'md:pl-6',  margin: 'md:m-6',  marginX: 'md:mx-6',  marginY: 'md:my-6',  marginTop: 'md:mt-6',  marginRight: 'md:mr-6',  marginBottom: 'md:mb-6',  marginLeft: 'md:ml-6',  gap: 'md:gap-6',  rowGap: 'md:gap-y-6',  columnGap: 'md:gap-x-6' },
    'spacing-4':   { padding: 'md:p-8',  paddingX: 'md:px-8',  paddingY: 'md:py-8',  paddingTop: 'md:pt-8',  paddingRight: 'md:pr-8',  paddingBottom: 'md:pb-8',  paddingLeft: 'md:pl-8',  margin: 'md:m-8',  marginX: 'md:mx-8',  marginY: 'md:my-8',  marginTop: 'md:mt-8',  marginRight: 'md:mr-8',  marginBottom: 'md:mb-8',  marginLeft: 'md:ml-8',  gap: 'md:gap-8',  rowGap: 'md:gap-y-8',  columnGap: 'md:gap-x-8' },
    'spacing-5':   { padding: 'md:p-10', paddingX: 'md:px-10', paddingY: 'md:py-10', paddingTop: 'md:pt-10', paddingRight: 'md:pr-10', paddingBottom: 'md:pb-10', paddingLeft: 'md:pl-10', margin: 'md:m-10', marginX: 'md:mx-10', marginY: 'md:my-10', marginTop: 'md:mt-10', marginRight: 'md:mr-10', marginBottom: 'md:mb-10', marginLeft: 'md:ml-10', gap: 'md:gap-10', rowGap: 'md:gap-y-10', columnGap: 'md:gap-x-10' },
    'spacing-6':   { padding: 'md:p-12', paddingX: 'md:px-12', paddingY: 'md:py-12', paddingTop: 'md:pt-12', paddingRight: 'md:pr-12', paddingBottom: 'md:pb-12', paddingLeft: 'md:pl-12', margin: 'md:m-12', marginX: 'md:mx-12', marginY: 'md:my-12', marginTop: 'md:mt-12', marginRight: 'md:mr-12', marginBottom: 'md:mb-12', marginLeft: 'md:ml-12', gap: 'md:gap-12', rowGap: 'md:gap-y-12', columnGap: 'md:gap-x-12' },
    'spacing-8':   { padding: 'md:p-16', paddingX: 'md:px-16', paddingY: 'md:py-16', paddingTop: 'md:pt-16', paddingRight: 'md:pr-16', paddingBottom: 'md:pb-16', paddingLeft: 'md:pl-16', margin: 'md:m-16', marginX: 'md:mx-16', marginY: 'md:my-16', marginTop: 'md:mt-16', marginRight: 'md:mr-16', marginBottom: 'md:mb-16', marginLeft: 'md:ml-16', gap: 'md:gap-16', rowGap: 'md:gap-y-16', columnGap: 'md:gap-x-16' },
    'spacing-10':  { padding: 'md:p-20', paddingX: 'md:px-20', paddingY: 'md:py-20', paddingTop: 'md:pt-20', paddingRight: 'md:pr-20', paddingBottom: 'md:pb-20', paddingLeft: 'md:pl-20', margin: 'md:m-20', marginX: 'md:mx-20', marginY: 'md:my-20', marginTop: 'md:mt-20', marginRight: 'md:mr-20', marginBottom: 'md:mb-20', marginLeft: 'md:ml-20', gap: 'md:gap-20', rowGap: 'md:gap-y-20', columnGap: 'md:gap-x-20' },
    'spacing-12':  { padding: 'md:p-24', paddingX: 'md:px-24', paddingY: 'md:py-24', paddingTop: 'md:pt-24', paddingRight: 'md:pr-24', paddingBottom: 'md:pb-24', paddingLeft: 'md:pl-24', margin: 'md:m-24', marginX: 'md:mx-24', marginY: 'md:my-24', marginTop: 'md:mt-24', marginRight: 'md:mr-24', marginBottom: 'md:mb-24', marginLeft: 'md:ml-24', gap: 'md:gap-24', rowGap: 'md:gap-y-24', columnGap: 'md:gap-x-24' },
    'spacing-16':  { padding: 'md:p-32', paddingX: 'md:px-32', paddingY: 'md:py-32', paddingTop: 'md:pt-32', paddingRight: 'md:pr-32', paddingBottom: 'md:pb-32', paddingLeft: 'md:pl-32', margin: 'md:m-32', marginX: 'md:mx-32', marginY: 'md:my-32', marginTop: 'md:mt-32', marginRight: 'md:mr-32', marginBottom: 'md:mb-32', marginLeft: 'md:ml-32', gap: 'md:gap-32', rowGap: 'md:gap-y-32', columnGap: 'md:gap-x-32' },
    'spacing-32':  { padding: 'md:p-64', paddingX: 'md:px-64', paddingY: 'md:py-64', paddingTop: 'md:pt-64', paddingRight: 'md:pr-64', paddingBottom: 'md:pb-64', paddingLeft: 'md:pl-64', margin: 'md:m-64', marginX: 'md:mx-64', marginY: 'md:my-64', marginTop: 'md:mt-64', marginRight: 'md:mr-64', marginBottom: 'md:mb-64', marginLeft: 'md:ml-64', gap: 'md:gap-64', rowGap: 'md:gap-y-64', columnGap: 'md:gap-x-64' },
  },
  lg: {
    'spacing-0':   { padding: 'lg:p-0',  paddingX: 'lg:px-0',  paddingY: 'lg:py-0',  paddingTop: 'lg:pt-0',  paddingRight: 'lg:pr-0',  paddingBottom: 'lg:pb-0',  paddingLeft: 'lg:pl-0',  margin: 'lg:m-0',  marginX: 'lg:mx-0',  marginY: 'lg:my-0',  marginTop: 'lg:mt-0',  marginRight: 'lg:mr-0',  marginBottom: 'lg:mb-0',  marginLeft: 'lg:ml-0',  gap: 'lg:gap-0',  rowGap: 'lg:gap-y-0',  columnGap: 'lg:gap-x-0' },
    'spacing-1':   { padding: 'lg:p-2',  paddingX: 'lg:px-2',  paddingY: 'lg:py-2',  paddingTop: 'lg:pt-2',  paddingRight: 'lg:pr-2',  paddingBottom: 'lg:pb-2',  paddingLeft: 'lg:pl-2',  margin: 'lg:m-2',  marginX: 'lg:mx-2',  marginY: 'lg:my-2',  marginTop: 'lg:mt-2',  marginRight: 'lg:mr-2',  marginBottom: 'lg:mb-2',  marginLeft: 'lg:ml-2',  gap: 'lg:gap-2',  rowGap: 'lg:gap-y-2',  columnGap: 'lg:gap-x-2' },
    'spacing-2':   { padding: 'lg:p-4',  paddingX: 'lg:px-4',  paddingY: 'lg:py-4',  paddingTop: 'lg:pt-4',  paddingRight: 'lg:pr-4',  paddingBottom: 'lg:pb-4',  paddingLeft: 'lg:pl-4',  margin: 'lg:m-4',  marginX: 'lg:mx-4',  marginY: 'lg:my-4',  marginTop: 'lg:mt-4',  marginRight: 'lg:mr-4',  marginBottom: 'lg:mb-4',  marginLeft: 'lg:ml-4',  gap: 'lg:gap-4',  rowGap: 'lg:gap-y-4',  columnGap: 'lg:gap-x-4' },
    'spacing-3':   { padding: 'lg:p-6',  paddingX: 'lg:px-6',  paddingY: 'lg:py-6',  paddingTop: 'lg:pt-6',  paddingRight: 'lg:pr-6',  paddingBottom: 'lg:pb-6',  paddingLeft: 'lg:pl-6',  margin: 'lg:m-6',  marginX: 'lg:mx-6',  marginY: 'lg:my-6',  marginTop: 'lg:mt-6',  marginRight: 'lg:mr-6',  marginBottom: 'lg:mb-6',  marginLeft: 'lg:ml-6',  gap: 'lg:gap-6',  rowGap: 'lg:gap-y-6',  columnGap: 'lg:gap-x-6' },
    'spacing-4':   { padding: 'lg:p-8',  paddingX: 'lg:px-8',  paddingY: 'lg:py-8',  paddingTop: 'lg:pt-8',  paddingRight: 'lg:pr-8',  paddingBottom: 'lg:pb-8',  paddingLeft: 'lg:pl-8',  margin: 'lg:m-8',  marginX: 'lg:mx-8',  marginY: 'lg:my-8',  marginTop: 'lg:mt-8',  marginRight: 'lg:mr-8',  marginBottom: 'lg:mb-8',  marginLeft: 'lg:ml-8',  gap: 'lg:gap-8',  rowGap: 'lg:gap-y-8',  columnGap: 'lg:gap-x-8' },
    'spacing-5':   { padding: 'lg:p-10', paddingX: 'lg:px-10', paddingY: 'lg:py-10', paddingTop: 'lg:pt-10', paddingRight: 'lg:pr-10', paddingBottom: 'lg:pb-10', paddingLeft: 'lg:pl-10', margin: 'lg:m-10', marginX: 'lg:mx-10', marginY: 'lg:my-10', marginTop: 'lg:mt-10', marginRight: 'lg:mr-10', marginBottom: 'lg:mb-10', marginLeft: 'lg:ml-10', gap: 'lg:gap-10', rowGap: 'lg:gap-y-10', columnGap: 'lg:gap-x-10' },
    'spacing-6':   { padding: 'lg:p-12', paddingX: 'lg:px-12', paddingY: 'lg:py-12', paddingTop: 'lg:pt-12', paddingRight: 'lg:pr-12', paddingBottom: 'lg:pb-12', paddingLeft: 'lg:pl-12', margin: 'lg:m-12', marginX: 'lg:mx-12', marginY: 'lg:my-12', marginTop: 'lg:mt-12', marginRight: 'lg:mr-12', marginBottom: 'lg:mb-12', marginLeft: 'lg:ml-12', gap: 'lg:gap-12', rowGap: 'lg:gap-y-12', columnGap: 'lg:gap-x-12' },
    'spacing-8':   { padding: 'lg:p-16', paddingX: 'lg:px-16', paddingY: 'lg:py-16', paddingTop: 'lg:pt-16', paddingRight: 'lg:pr-16', paddingBottom: 'lg:pb-16', paddingLeft: 'lg:pl-16', margin: 'lg:m-16', marginX: 'lg:mx-16', marginY: 'lg:my-16', marginTop: 'lg:mt-16', marginRight: 'lg:mr-16', marginBottom: 'lg:mb-16', marginLeft: 'lg:ml-16', gap: 'lg:gap-16', rowGap: 'lg:gap-y-16', columnGap: 'lg:gap-x-16' },
    'spacing-10':  { padding: 'lg:p-20', paddingX: 'lg:px-20', paddingY: 'lg:py-20', paddingTop: 'lg:pt-20', paddingRight: 'lg:pr-20', paddingBottom: 'lg:pb-20', paddingLeft: 'lg:pl-20', margin: 'lg:m-20', marginX: 'lg:mx-20', marginY: 'lg:my-20', marginTop: 'lg:mt-20', marginRight: 'lg:mr-20', marginBottom: 'lg:mb-20', marginLeft: 'lg:ml-20', gap: 'lg:gap-20', rowGap: 'lg:gap-y-20', columnGap: 'lg:gap-x-20' },
    'spacing-12':  { padding: 'lg:p-24', paddingX: 'lg:px-24', paddingY: 'lg:py-24', paddingTop: 'lg:pt-24', paddingRight: 'lg:pr-24', paddingBottom: 'lg:pb-24', paddingLeft: 'lg:pl-24', margin: 'lg:m-24', marginX: 'lg:mx-24', marginY: 'lg:my-24', marginTop: 'lg:mt-24', marginRight: 'lg:mr-24', marginBottom: 'lg:mb-24', marginLeft: 'lg:ml-24', gap: 'lg:gap-24', rowGap: 'lg:gap-y-24', columnGap: 'lg:gap-x-24' },
    'spacing-16':  { padding: 'lg:p-32', paddingX: 'lg:px-32', paddingY: 'lg:py-32', paddingTop: 'lg:pt-32', paddingRight: 'lg:pr-32', paddingBottom: 'lg:pb-32', paddingLeft: 'lg:pl-32', margin: 'lg:m-32', marginX: 'lg:mx-32', marginY: 'lg:my-32', marginTop: 'lg:mt-32', marginRight: 'lg:mr-32', marginBottom: 'lg:mb-32', marginLeft: 'lg:ml-32', gap: 'lg:gap-32', rowGap: 'lg:gap-y-32', columnGap: 'lg:gap-x-32' },
    'spacing-32':  { padding: 'lg:p-64', paddingX: 'lg:px-64', paddingY: 'lg:py-64', paddingTop: 'lg:pt-64', paddingRight: 'lg:pr-64', paddingBottom: 'lg:pb-64', paddingLeft: 'lg:pl-64', margin: 'lg:m-64', marginX: 'lg:mx-64', marginY: 'lg:my-64', marginTop: 'lg:mt-64', marginRight: 'lg:mr-64', marginBottom: 'lg:mb-64', marginLeft: 'lg:ml-64', gap: 'lg:gap-64', rowGap: 'lg:gap-y-64', columnGap: 'lg:gap-x-64' },
  },
  xl: {
    'spacing-0':   { padding: 'xl:p-0',  paddingX: 'xl:px-0',  paddingY: 'xl:py-0',  paddingTop: 'xl:pt-0',  paddingRight: 'xl:pr-0',  paddingBottom: 'xl:pb-0',  paddingLeft: 'xl:pl-0',  margin: 'xl:m-0',  marginX: 'xl:mx-0',  marginY: 'xl:my-0',  marginTop: 'xl:mt-0',  marginRight: 'xl:mr-0',  marginBottom: 'xl:mb-0',  marginLeft: 'xl:ml-0',  gap: 'xl:gap-0',  rowGap: 'xl:gap-y-0',  columnGap: 'xl:gap-x-0' },
    'spacing-1':   { padding: 'xl:p-2',  paddingX: 'xl:px-2',  paddingY: 'xl:py-2',  paddingTop: 'xl:pt-2',  paddingRight: 'xl:pr-2',  paddingBottom: 'xl:pb-2',  paddingLeft: 'xl:pl-2',  margin: 'xl:m-2',  marginX: 'xl:mx-2',  marginY: 'xl:my-2',  marginTop: 'xl:mt-2',  marginRight: 'xl:mr-2',  marginBottom: 'xl:mb-2',  marginLeft: 'xl:ml-2',  gap: 'xl:gap-2',  rowGap: 'xl:gap-y-2',  columnGap: 'xl:gap-x-2' },
    'spacing-2':   { padding: 'xl:p-4',  paddingX: 'xl:px-4',  paddingY: 'xl:py-4',  paddingTop: 'xl:pt-4',  paddingRight: 'xl:pr-4',  paddingBottom: 'xl:pb-4',  paddingLeft: 'xl:pl-4',  margin: 'xl:m-4',  marginX: 'xl:mx-4',  marginY: 'xl:my-4',  marginTop: 'xl:mt-4',  marginRight: 'xl:mr-4',  marginBottom: 'xl:mb-4',  marginLeft: 'xl:ml-4',  gap: 'xl:gap-4',  rowGap: 'xl:gap-y-4',  columnGap: 'xl:gap-x-4' },
    'spacing-3':   { padding: 'xl:p-6',  paddingX: 'xl:px-6',  paddingY: 'xl:py-6',  paddingTop: 'xl:pt-6',  paddingRight: 'xl:pr-6',  paddingBottom: 'xl:pb-6',  paddingLeft: 'xl:pl-6',  margin: 'xl:m-6',  marginX: 'xl:mx-6',  marginY: 'xl:my-6',  marginTop: 'xl:mt-6',  marginRight: 'xl:mr-6',  marginBottom: 'xl:mb-6',  marginLeft: 'xl:ml-6',  gap: 'xl:gap-6',  rowGap: 'xl:gap-y-6',  columnGap: 'xl:gap-x-6' },
    'spacing-4':   { padding: 'xl:p-8',  paddingX: 'xl:px-8',  paddingY: 'xl:py-8',  paddingTop: 'xl:pt-8',  paddingRight: 'xl:pr-8',  paddingBottom: 'xl:pb-8',  paddingLeft: 'xl:pl-8',  margin: 'xl:m-8',  marginX: 'xl:mx-8',  marginY: 'xl:my-8',  marginTop: 'xl:mt-8',  marginRight: 'xl:mr-8',  marginBottom: 'xl:mb-8',  marginLeft: 'xl:ml-8',  gap: 'xl:gap-8',  rowGap: 'xl:gap-y-8',  columnGap: 'xl:gap-x-8' },
    'spacing-5':   { padding: 'xl:p-10', paddingX: 'xl:px-10', paddingY: 'xl:py-10', paddingTop: 'xl:pt-10', paddingRight: 'xl:pr-10', paddingBottom: 'xl:pb-10', paddingLeft: 'xl:pl-10', margin: 'xl:m-10', marginX: 'xl:mx-10', marginY: 'xl:my-10', marginTop: 'xl:mt-10', marginRight: 'xl:mr-10', marginBottom: 'xl:mb-10', marginLeft: 'xl:ml-10', gap: 'xl:gap-10', rowGap: 'xl:gap-y-10', columnGap: 'xl:gap-x-10' },
    'spacing-6':   { padding: 'xl:p-12', paddingX: 'xl:px-12', paddingY: 'xl:py-12', paddingTop: 'xl:pt-12', paddingRight: 'xl:pr-12', paddingBottom: 'xl:pb-12', paddingLeft: 'xl:pl-12', margin: 'xl:m-12', marginX: 'xl:mx-12', marginY: 'xl:my-12', marginTop: 'xl:mt-12', marginRight: 'xl:mr-12', marginBottom: 'xl:mb-12', marginLeft: 'xl:ml-12', gap: 'xl:gap-12', rowGap: 'xl:gap-y-12', columnGap: 'xl:gap-x-12' },
    'spacing-8':   { padding: 'xl:p-16', paddingX: 'xl:px-16', paddingY: 'xl:py-16', paddingTop: 'xl:pt-16', paddingRight: 'xl:pr-16', paddingBottom: 'xl:pb-16', paddingLeft: 'xl:pl-16', margin: 'xl:m-16', marginX: 'xl:mx-16', marginY: 'xl:my-16', marginTop: 'xl:mt-16', marginRight: 'xl:mr-16', marginBottom: 'xl:mb-16', marginLeft: 'xl:ml-16', gap: 'xl:gap-16', rowGap: 'xl:gap-y-16', columnGap: 'xl:gap-x-16' },
    'spacing-10':  { padding: 'xl:p-20', paddingX: 'xl:px-20', paddingY: 'xl:py-20', paddingTop: 'xl:pt-20', paddingRight: 'xl:pr-20', paddingBottom: 'xl:pb-20', paddingLeft: 'xl:pl-20', margin: 'xl:m-20', marginX: 'xl:mx-20', marginY: 'xl:my-20', marginTop: 'xl:mt-20', marginRight: 'xl:mr-20', marginBottom: 'xl:mb-20', marginLeft: 'xl:ml-20', gap: 'xl:gap-20', rowGap: 'xl:gap-y-20', columnGap: 'xl:gap-x-20' },
    'spacing-12':  { padding: 'xl:p-24', paddingX: 'xl:px-24', paddingY: 'xl:py-24', paddingTop: 'xl:pt-24', paddingRight: 'xl:pr-24', paddingBottom: 'xl:pb-24', paddingLeft: 'xl:pl-24', margin: 'xl:m-24', marginX: 'xl:mx-24', marginY: 'xl:my-24', marginTop: 'xl:mt-24', marginRight: 'xl:mr-24', marginBottom: 'xl:mb-24', marginLeft: 'xl:ml-24', gap: 'xl:gap-24', rowGap: 'xl:gap-y-24', columnGap: 'xl:gap-x-24' },
    'spacing-16':  { padding: 'xl:p-32', paddingX: 'xl:px-32', paddingY: 'xl:py-32', paddingTop: 'xl:pt-32', paddingRight: 'xl:pr-32', paddingBottom: 'xl:pb-32', paddingLeft: 'xl:pl-32', margin: 'xl:m-32', marginX: 'xl:mx-32', marginY: 'xl:my-32', marginTop: 'xl:mt-32', marginRight: 'xl:mr-32', marginBottom: 'xl:mb-32', marginLeft: 'xl:ml-32', gap: 'xl:gap-32', rowGap: 'xl:gap-y-32', columnGap: 'xl:gap-x-32' },
    'spacing-32':  { padding: 'xl:p-64', paddingX: 'xl:px-64', paddingY: 'xl:py-64', paddingTop: 'xl:pt-64', paddingRight: 'xl:pr-64', paddingBottom: 'xl:pb-64', paddingLeft: 'xl:pl-64', margin: 'xl:m-64', marginX: 'xl:mx-64', marginY: 'xl:my-64', marginTop: 'xl:mt-64', marginRight: 'xl:mr-64', marginBottom: 'xl:mb-64', marginLeft: 'xl:ml-64', gap: 'xl:gap-64', rowGap: 'xl:gap-y-64', columnGap: 'xl:gap-x-64' },
  },
  '2xl': {
    'spacing-0':   { padding: '2xl:p-0',  paddingX: '2xl:px-0',  paddingY: '2xl:py-0',  paddingTop: '2xl:pt-0',  paddingRight: '2xl:pr-0',  paddingBottom: '2xl:pb-0',  paddingLeft: '2xl:pl-0',  margin: '2xl:m-0',  marginX: '2xl:mx-0',  marginY: '2xl:my-0',  marginTop: '2xl:mt-0',  marginRight: '2xl:mr-0',  marginBottom: '2xl:mb-0',  marginLeft: '2xl:ml-0',  gap: '2xl:gap-0',  rowGap: '2xl:gap-y-0',  columnGap: '2xl:gap-x-0' },
    'spacing-1':   { padding: '2xl:p-2',  paddingX: '2xl:px-2',  paddingY: '2xl:py-2',  paddingTop: '2xl:pt-2',  paddingRight: '2xl:pr-2',  paddingBottom: '2xl:pb-2',  paddingLeft: '2xl:pl-2',  margin: '2xl:m-2',  marginX: '2xl:mx-2',  marginY: '2xl:my-2',  marginTop: '2xl:mt-2',  marginRight: '2xl:mr-2',  marginBottom: '2xl:mb-2',  marginLeft: '2xl:ml-2',  gap: '2xl:gap-2',  rowGap: '2xl:gap-y-2',  columnGap: '2xl:gap-x-2' },
    'spacing-2':   { padding: '2xl:p-4',  paddingX: '2xl:px-4',  paddingY: '2xl:py-4',  paddingTop: '2xl:pt-4',  paddingRight: '2xl:pr-4',  paddingBottom: '2xl:pb-4',  paddingLeft: '2xl:pl-4',  margin: '2xl:m-4',  marginX: '2xl:mx-4',  marginY: '2xl:my-4',  marginTop: '2xl:mt-4',  marginRight: '2xl:mr-4',  marginBottom: '2xl:mb-4',  marginLeft: '2xl:ml-4',  gap: '2xl:gap-4',  rowGap: '2xl:gap-y-4',  columnGap: '2xl:gap-x-4' },
    'spacing-3':   { padding: '2xl:p-6',  paddingX: '2xl:px-6',  paddingY: '2xl:py-6',  paddingTop: '2xl:pt-6',  paddingRight: '2xl:pr-6',  paddingBottom: '2xl:pb-6',  paddingLeft: '2xl:pl-6',  margin: '2xl:m-6',  marginX: '2xl:mx-6',  marginY: '2xl:my-6',  marginTop: '2xl:mt-6',  marginRight: '2xl:mr-6',  marginBottom: '2xl:mb-6',  marginLeft: '2xl:ml-6',  gap: '2xl:gap-6',  rowGap: '2xl:gap-y-6',  columnGap: '2xl:gap-x-6' },
    'spacing-4':   { padding: '2xl:p-8',  paddingX: '2xl:px-8',  paddingY: '2xl:py-8',  paddingTop: '2xl:pt-8',  paddingRight: '2xl:pr-8',  paddingBottom: '2xl:pb-8',  paddingLeft: '2xl:pl-8',  margin: '2xl:m-8',  marginX: '2xl:mx-8',  marginY: '2xl:my-8',  marginTop: '2xl:mt-8',  marginRight: '2xl:mr-8',  marginBottom: '2xl:mb-8',  marginLeft: '2xl:ml-8',  gap: '2xl:gap-8',  rowGap: '2xl:gap-y-8',  columnGap: '2xl:gap-x-8' },
    'spacing-5':   { padding: '2xl:p-10', paddingX: '2xl:px-10', paddingY: '2xl:py-10', paddingTop: '2xl:pt-10', paddingRight: '2xl:pr-10', paddingBottom: '2xl:pb-10', paddingLeft: '2xl:pl-10', margin: '2xl:m-10', marginX: '2xl:mx-10', marginY: '2xl:my-10', marginTop: '2xl:mt-10', marginRight: '2xl:mr-10', marginBottom: '2xl:mb-10', marginLeft: '2xl:ml-10', gap: '2xl:gap-10', rowGap: '2xl:gap-y-10', columnGap: '2xl:gap-x-10' },
    'spacing-6':   { padding: '2xl:p-12', paddingX: '2xl:px-12', paddingY: '2xl:py-12', paddingTop: '2xl:pt-12', paddingRight: '2xl:pr-12', paddingBottom: '2xl:pb-12', paddingLeft: '2xl:pl-12', margin: '2xl:m-12', marginX: '2xl:mx-12', marginY: '2xl:my-12', marginTop: '2xl:mt-12', marginRight: '2xl:mr-12', marginBottom: '2xl:mb-12', marginLeft: '2xl:ml-12', gap: '2xl:gap-12', rowGap: '2xl:gap-y-12', columnGap: '2xl:gap-x-12' },
    'spacing-8':   { padding: '2xl:p-16', paddingX: '2xl:px-16', paddingY: '2xl:py-16', paddingTop: '2xl:pt-16', paddingRight: '2xl:pr-16', paddingBottom: '2xl:pb-16', paddingLeft: '2xl:pl-16', margin: '2xl:m-16', marginX: '2xl:mx-16', marginY: '2xl:my-16', marginTop: '2xl:mt-16', marginRight: '2xl:mr-16', marginBottom: '2xl:mb-16', marginLeft: '2xl:ml-16', gap: '2xl:gap-16', rowGap: '2xl:gap-y-16', columnGap: '2xl:gap-x-16' },
    'spacing-10':  { padding: '2xl:p-20', paddingX: '2xl:px-20', paddingY: '2xl:py-20', paddingTop: '2xl:pt-20', paddingRight: '2xl:pr-20', paddingBottom: '2xl:pb-20', paddingLeft: '2xl:pl-20', margin: '2xl:m-20', marginX: '2xl:mx-20', marginY: '2xl:my-20', marginTop: '2xl:mt-20', marginRight: '2xl:mr-20', marginBottom: '2xl:mb-20', marginLeft: '2xl:ml-20', gap: '2xl:gap-20', rowGap: '2xl:gap-y-20', columnGap: '2xl:gap-x-20' },
    'spacing-12':  { padding: '2xl:p-24', paddingX: '2xl:px-24', paddingY: '2xl:py-24', paddingTop: '2xl:pt-24', paddingRight: '2xl:pr-24', paddingBottom: '2xl:pb-24', paddingLeft: '2xl:pl-24', margin: '2xl:m-24', marginX: '2xl:mx-24', marginY: '2xl:my-24', marginTop: '2xl:mt-24', marginRight: '2xl:mr-24', marginBottom: '2xl:mb-24', marginLeft: '2xl:ml-24', gap: '2xl:gap-24', rowGap: '2xl:gap-y-24', columnGap: '2xl:gap-x-24' },
    'spacing-16':  { padding: '2xl:p-32', paddingX: '2xl:px-32', paddingY: '2xl:py-32', paddingTop: '2xl:pt-32', paddingRight: '2xl:pr-32', paddingBottom: '2xl:pb-32', paddingLeft: '2xl:pl-32', margin: '2xl:m-32', marginX: '2xl:mx-32', marginY: '2xl:my-32', marginTop: '2xl:mt-32', marginRight: '2xl:mr-32', marginBottom: '2xl:mb-32', marginLeft: '2xl:ml-32', gap: '2xl:gap-32', rowGap: '2xl:gap-y-32', columnGap: '2xl:gap-x-32' },
    'spacing-32':  { padding: '2xl:p-64', paddingX: '2xl:px-64', paddingY: '2xl:py-64', paddingTop: '2xl:pt-64', paddingRight: '2xl:pr-64', paddingBottom: '2xl:pb-64', paddingLeft: '2xl:pl-64', margin: '2xl:m-64', marginX: '2xl:mx-64', marginY: '2xl:my-64', marginTop: '2xl:mt-64', marginRight: '2xl:mr-64', marginBottom: '2xl:mb-64', marginLeft: '2xl:ml-64', gap: '2xl:gap-64', rowGap: '2xl:gap-y-64', columnGap: '2xl:gap-x-64' },
  },
}

// ─── Shared helper ────────────────────────────────────────────────────────────
// Never concatenate prefix + class — always look up from pre-built tables.
// Tailwind JIT scans this file and compiles every literal string it finds.

function resolveFlexProp<V extends string>(
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

// ─── Radius breakpoint table ──────────────────────────────────────────────────

const RADIUS_BP: Record<string, Record<string, RadiusClasses>> = {
  sm:  { sm: { all: 'sm:rounded-lg',    tl: 'sm:rounded-tl-lg',    tr: 'sm:rounded-tr-lg',    bl: 'sm:rounded-bl-lg',    br: 'sm:rounded-br-lg'    }, md: { all: 'sm:rounded-xl',    tl: 'sm:rounded-tl-xl',    tr: 'sm:rounded-tr-xl',    bl: 'sm:rounded-bl-xl',    br: 'sm:rounded-br-xl'    }, lg: { all: 'sm:rounded-2xl',   tl: 'sm:rounded-tl-2xl',   tr: 'sm:rounded-tr-2xl',   bl: 'sm:rounded-bl-2xl',   br: 'sm:rounded-br-2xl'   }, xl: { all: 'sm:rounded-3xl',   tl: 'sm:rounded-tl-3xl',   tr: 'sm:rounded-tr-3xl',   bl: 'sm:rounded-bl-3xl',   br: 'sm:rounded-br-3xl'   }, '2xl': { all: 'sm:rounded-4xl',  tl: 'sm:rounded-tl-4xl',   tr: 'sm:rounded-tr-4xl',   bl: 'sm:rounded-bl-4xl',   br: 'sm:rounded-br-4xl'   }, full: { all: 'sm:rounded-full',  tl: 'sm:rounded-tl-full',  tr: 'sm:rounded-tr-full',  bl: 'sm:rounded-bl-full',  br: 'sm:rounded-br-full'  } },
  md:  { sm: { all: 'md:rounded-lg',    tl: 'md:rounded-tl-lg',    tr: 'md:rounded-tr-lg',    bl: 'md:rounded-bl-lg',    br: 'md:rounded-br-lg'    }, md: { all: 'md:rounded-xl',    tl: 'md:rounded-tl-xl',    tr: 'md:rounded-tr-xl',    bl: 'md:rounded-bl-xl',    br: 'md:rounded-br-xl'    }, lg: { all: 'md:rounded-2xl',   tl: 'md:rounded-tl-2xl',   tr: 'md:rounded-tr-2xl',   bl: 'md:rounded-bl-2xl',   br: 'md:rounded-br-2xl'   }, xl: { all: 'md:rounded-3xl',   tl: 'md:rounded-tl-3xl',   tr: 'md:rounded-tr-3xl',   bl: 'md:rounded-bl-3xl',   br: 'md:rounded-br-3xl'   }, '2xl': { all: 'md:rounded-4xl',  tl: 'md:rounded-tl-4xl',   tr: 'md:rounded-tr-4xl',   bl: 'md:rounded-bl-4xl',   br: 'md:rounded-br-4xl'   }, full: { all: 'md:rounded-full',  tl: 'md:rounded-tl-full',  tr: 'md:rounded-tr-full',  bl: 'md:rounded-bl-full',  br: 'md:rounded-br-full'  } },
  lg:  { sm: { all: 'lg:rounded-lg',    tl: 'lg:rounded-tl-lg',    tr: 'lg:rounded-tr-lg',    bl: 'lg:rounded-bl-lg',    br: 'lg:rounded-br-lg'    }, md: { all: 'lg:rounded-xl',    tl: 'lg:rounded-tl-xl',    tr: 'lg:rounded-tr-xl',    bl: 'lg:rounded-bl-xl',    br: 'lg:rounded-br-xl'    }, lg: { all: 'lg:rounded-2xl',   tl: 'lg:rounded-tl-2xl',   tr: 'lg:rounded-tr-2xl',   bl: 'lg:rounded-bl-2xl',   br: 'lg:rounded-br-2xl'   }, xl: { all: 'lg:rounded-3xl',   tl: 'lg:rounded-tl-3xl',   tr: 'lg:rounded-tr-3xl',   bl: 'lg:rounded-bl-3xl',   br: 'lg:rounded-br-3xl'   }, '2xl': { all: 'lg:rounded-4xl',  tl: 'lg:rounded-tl-4xl',   tr: 'lg:rounded-tr-4xl',   bl: 'lg:rounded-bl-4xl',   br: 'lg:rounded-br-4xl'   }, full: { all: 'lg:rounded-full',  tl: 'lg:rounded-tl-full',  tr: 'lg:rounded-tr-full',  bl: 'lg:rounded-bl-full',  br: 'lg:rounded-br-full'  } },
  xl:  { sm: { all: 'xl:rounded-lg',    tl: 'xl:rounded-tl-lg',    tr: 'xl:rounded-tr-lg',    bl: 'xl:rounded-bl-lg',    br: 'xl:rounded-br-lg'    }, md: { all: 'xl:rounded-xl',    tl: 'xl:rounded-tl-xl',    tr: 'xl:rounded-tr-xl',    bl: 'xl:rounded-bl-xl',    br: 'xl:rounded-br-xl'    }, lg: { all: 'xl:rounded-2xl',   tl: 'xl:rounded-tl-2xl',   tr: 'xl:rounded-tr-2xl',   bl: 'xl:rounded-bl-2xl',   br: 'xl:rounded-br-2xl'   }, xl: { all: 'xl:rounded-3xl',   tl: 'xl:rounded-tl-3xl',   tr: 'xl:rounded-tr-3xl',   bl: 'xl:rounded-bl-3xl',   br: 'xl:rounded-br-3xl'   }, '2xl': { all: 'xl:rounded-4xl',  tl: 'xl:rounded-tl-4xl',   tr: 'xl:rounded-tr-4xl',   bl: 'xl:rounded-bl-4xl',   br: 'xl:rounded-br-4xl'   }, full: { all: 'xl:rounded-full',  tl: 'xl:rounded-tl-full',  tr: 'xl:rounded-tr-full',  bl: 'xl:rounded-bl-full',  br: 'xl:rounded-br-full'  } },
  '2xl': { sm: { all: '2xl:rounded-lg',  tl: '2xl:rounded-tl-lg',  tr: '2xl:rounded-tr-lg',  bl: '2xl:rounded-bl-lg',  br: '2xl:rounded-br-lg'  }, md: { all: '2xl:rounded-xl',  tl: '2xl:rounded-tl-xl',  tr: '2xl:rounded-tr-xl',  bl: '2xl:rounded-bl-xl',  br: '2xl:rounded-br-xl'  }, lg: { all: '2xl:rounded-2xl', tl: '2xl:rounded-tl-2xl', tr: '2xl:rounded-tr-2xl', bl: '2xl:rounded-bl-2xl', br: '2xl:rounded-br-2xl' }, xl: { all: '2xl:rounded-3xl', tl: '2xl:rounded-tl-3xl', tr: '2xl:rounded-tr-3xl', bl: '2xl:rounded-bl-3xl', br: '2xl:rounded-br-3xl' }, '2xl': { all: '2xl:rounded-4xl', tl: '2xl:rounded-tl-4xl', tr: '2xl:rounded-tr-4xl', bl: '2xl:rounded-bl-4xl', br: '2xl:rounded-br-4xl' }, full: { all: '2xl:rounded-full', tl: '2xl:rounded-tl-full', tr: '2xl:rounded-tr-full', bl: '2xl:rounded-bl-full', br: '2xl:rounded-br-full' } },
}

// ─── Color breakpoint table ───────────────────────────────────────────────────

const COLOR_BP: Record<string, Record<string, ColorClasses>> = {
  sm:  { bg: { background: 'sm:bg-[var(--orbit-bg)]', text: 'sm:text-[var(--orbit-bg)]', border: 'sm:border-[var(--orbit-bg)]' }, 'bg-surface': { background: 'sm:bg-[var(--orbit-bg-surface)]', text: 'sm:text-[var(--orbit-bg-surface)]', border: 'sm:border-[var(--orbit-bg-surface)]' }, 'bg-elevated': { background: 'sm:bg-[var(--orbit-bg-elevated)]', text: 'sm:text-[var(--orbit-bg-elevated)]', border: 'sm:border-[var(--orbit-bg-elevated)]' }, text: { background: 'sm:bg-[var(--orbit-text)]', text: 'sm:text-[var(--orbit-text)]', border: 'sm:border-[var(--orbit-text)]' }, 'text-disabled': { text: 'sm:text-[var(--orbit-text-disabled)]' }, 'text-subtle': { background: 'sm:bg-[var(--orbit-text-subtle)]', text: 'sm:text-[var(--orbit-text-subtle)]', border: 'sm:border-[var(--orbit-text-subtle)]' }, destructive: { background: 'sm:bg-[var(--orbit-destructive)]', text: 'sm:text-[var(--orbit-destructive)]', border: 'sm:border-[var(--orbit-destructive)]' } },
  md:  { bg: { background: 'md:bg-[var(--orbit-bg)]', text: 'md:text-[var(--orbit-bg)]', border: 'md:border-[var(--orbit-bg)]' }, 'bg-surface': { background: 'md:bg-[var(--orbit-bg-surface)]', text: 'md:text-[var(--orbit-bg-surface)]', border: 'md:border-[var(--orbit-bg-surface)]' }, 'bg-elevated': { background: 'md:bg-[var(--orbit-bg-elevated)]', text: 'md:text-[var(--orbit-bg-elevated)]', border: 'md:border-[var(--orbit-bg-elevated)]' }, text: { background: 'md:bg-[var(--orbit-text)]', text: 'md:text-[var(--orbit-text)]', border: 'md:border-[var(--orbit-text)]' }, 'text-disabled': { text: 'md:text-[var(--orbit-text-disabled)]' }, 'text-subtle': { background: 'md:bg-[var(--orbit-text-subtle)]', text: 'md:text-[var(--orbit-text-subtle)]', border: 'md:border-[var(--orbit-text-subtle)]' }, destructive: { background: 'md:bg-[var(--orbit-destructive)]', text: 'md:text-[var(--orbit-destructive)]', border: 'md:border-[var(--orbit-destructive)]' } },
  lg:  { bg: { background: 'lg:bg-[var(--orbit-bg)]', text: 'lg:text-[var(--orbit-bg)]', border: 'lg:border-[var(--orbit-bg)]' }, 'bg-surface': { background: 'lg:bg-[var(--orbit-bg-surface)]', text: 'lg:text-[var(--orbit-bg-surface)]', border: 'lg:border-[var(--orbit-bg-surface)]' }, 'bg-elevated': { background: 'lg:bg-[var(--orbit-bg-elevated)]', text: 'lg:text-[var(--orbit-bg-elevated)]', border: 'lg:border-[var(--orbit-bg-elevated)]' }, text: { background: 'lg:bg-[var(--orbit-text)]', text: 'lg:text-[var(--orbit-text)]', border: 'lg:border-[var(--orbit-text)]' }, 'text-disabled': { text: 'lg:text-[var(--orbit-text-disabled)]' }, 'text-subtle': { background: 'lg:bg-[var(--orbit-text-subtle)]', text: 'lg:text-[var(--orbit-text-subtle)]', border: 'lg:border-[var(--orbit-text-subtle)]' }, destructive: { background: 'lg:bg-[var(--orbit-destructive)]', text: 'lg:text-[var(--orbit-destructive)]', border: 'lg:border-[var(--orbit-destructive)]' } },
  xl:  { bg: { background: 'xl:bg-[var(--orbit-bg)]', text: 'xl:text-[var(--orbit-bg)]', border: 'xl:border-[var(--orbit-bg)]' }, 'bg-surface': { background: 'xl:bg-[var(--orbit-bg-surface)]', text: 'xl:text-[var(--orbit-bg-surface)]', border: 'xl:border-[var(--orbit-bg-surface)]' }, 'bg-elevated': { background: 'xl:bg-[var(--orbit-bg-elevated)]', text: 'xl:text-[var(--orbit-bg-elevated)]', border: 'xl:border-[var(--orbit-bg-elevated)]' }, text: { background: 'xl:bg-[var(--orbit-text)]', text: 'xl:text-[var(--orbit-text)]', border: 'xl:border-[var(--orbit-text)]' }, 'text-disabled': { text: 'xl:text-[var(--orbit-text-disabled)]' }, 'text-subtle': { background: 'xl:bg-[var(--orbit-text-subtle)]', text: 'xl:text-[var(--orbit-text-subtle)]', border: 'xl:border-[var(--orbit-text-subtle)]' }, destructive: { background: 'xl:bg-[var(--orbit-destructive)]', text: 'xl:text-[var(--orbit-destructive)]', border: 'xl:border-[var(--orbit-destructive)]' } },
  '2xl': { bg: { background: '2xl:bg-[var(--orbit-bg)]', text: '2xl:text-[var(--orbit-bg)]', border: '2xl:border-[var(--orbit-bg)]' }, 'bg-surface': { background: '2xl:bg-[var(--orbit-bg-surface)]', text: '2xl:text-[var(--orbit-bg-surface)]', border: '2xl:border-[var(--orbit-bg-surface)]' }, 'bg-elevated': { background: '2xl:bg-[var(--orbit-bg-elevated)]', text: '2xl:text-[var(--orbit-bg-elevated)]', border: '2xl:border-[var(--orbit-bg-elevated)]' }, text: { background: '2xl:bg-[var(--orbit-text)]', text: '2xl:text-[var(--orbit-text)]', border: '2xl:border-[var(--orbit-text)]' }, 'text-disabled': { text: '2xl:text-[var(--orbit-text-disabled)]' }, 'text-subtle': { background: '2xl:bg-[var(--orbit-text-subtle)]', text: '2xl:text-[var(--orbit-text-subtle)]', border: '2xl:border-[var(--orbit-text-subtle)]' }, destructive: { background: '2xl:bg-[var(--orbit-destructive)]', text: '2xl:text-[var(--orbit-destructive)]', border: '2xl:border-[var(--orbit-destructive)]' } },
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
// Used by resolveProperties (Box). Props useful when Box is a flex/grid child.

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

// ─── resolveProperties ───────────────────────────────────────────────────────
// Used by Box to resolve token props + flex child props to Tailwind classes.

export function resolveProperties<T extends ThemeSpec>(
  theme: T,
  props: TokenProps<T> & FlexChildProps,
): string {
  const classes: string[] = []

  const spDef = (k: string, p: keyof SpacingClasses) => theme.spacing[k]?.[p]
  const spBp  = (bp: string, k: string, p: keyof SpacingClasses) => SPACING_BP[bp]?.[k]?.[p]
  const sp = (v: unknown, p: keyof SpacingClasses) =>
    resolveThemeProp(v, (k) => spDef(k as string, p), (bp, k) => spBp(bp, k as string, p))

  const rDef = (k: string, p: keyof RadiusClasses) => theme.radii[k]?.[p]
  const rBp  = (bp: string, k: string, p: keyof RadiusClasses) => RADIUS_BP[bp]?.[k]?.[p]
  const r = (v: unknown, p: keyof RadiusClasses) =>
    resolveThemeProp(v, (k) => rDef(k as string, p), (bp, k) => rBp(bp, k as string, p))

  const cDef = (k: string, p: keyof ColorClasses) => theme.colors[k]?.[p]
  const cBp  = (bp: string, k: string, p: keyof ColorClasses) => COLOR_BP[bp]?.[k]?.[p]
  const c = (v: unknown, p: keyof ColorClasses) =>
    resolveThemeProp(v, (k) => cDef(k as string, p), (bp, k) => cBp(bp, k as string, p))

  // ── Colors
  classes.push(...c(props.backgroundColor, 'background'))
  classes.push(...c(props.color, 'text'))
  classes.push(...c(props.borderColor, 'border'))

  // ── Spacing
  classes.push(...sp(props.padding, 'padding'))
  classes.push(...sp(props.paddingX, 'paddingX'))
  classes.push(...sp(props.paddingY, 'paddingY'))
  classes.push(...sp(props.paddingTop, 'paddingTop'))
  classes.push(...sp(props.paddingRight, 'paddingRight'))
  classes.push(...sp(props.paddingBottom, 'paddingBottom'))
  classes.push(...sp(props.paddingLeft, 'paddingLeft'))
  classes.push(...sp(props.margin, 'margin'))
  classes.push(...sp(props.marginX, 'marginX'))
  classes.push(...sp(props.marginY, 'marginY'))
  classes.push(...sp(props.marginTop, 'marginTop'))
  classes.push(...sp(props.marginRight, 'marginRight'))
  classes.push(...sp(props.marginBottom, 'marginBottom'))
  classes.push(...sp(props.marginLeft, 'marginLeft'))
  classes.push(...sp(props.gap, 'gap'))
  classes.push(...sp(props.rowGap, 'rowGap'))
  classes.push(...sp(props.columnGap, 'columnGap'))

  // ── Radii
  classes.push(...r(props.borderRadius, 'all'))
  classes.push(...r(props.borderTopLeftRadius, 'tl'))
  classes.push(...r(props.borderTopRightRadius, 'tr'))
  classes.push(...r(props.borderBottomLeftRadius, 'bl'))
  classes.push(...r(props.borderBottomRightRadius, 'br'))

  // ── Flex child props
  classes.push(...resolveFlexProp(props.flex, FLEX))
  classes.push(...resolveFlexProp(props.alignSelf, ALIGN_SELF))
  if (props.flexGrow !== undefined) classes.push(FLEX_GROW[props.flexGrow])
  if (props.flexShrink !== undefined) classes.push(FLEX_SHRINK[props.flexShrink])

  return classes.filter(Boolean).join(' ')
}
