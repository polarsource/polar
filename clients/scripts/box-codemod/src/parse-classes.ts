import type { Modifier, ParsedClass } from './types.ts'

const MODIFIERS = new Set<Modifier>([
  'dark',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  'hover',
  'focus',
  'active',
  'focus-visible',
  'focus-within',
])

export function parseClasses(input: string): ParsedClass[] {
  const tokens = input.split(/\s+/).filter(Boolean)
  return tokens.map(parseSingle)
}

function parseSingle(raw: string): ParsedClass {
  let s = raw
  let important = false
  if (s.startsWith('!')) {
    important = true
    s = s.slice(1)
  }
  if (s.endsWith('!')) {
    important = true
    s = s.slice(0, -1)
  }

  const modifiers: Modifier[] = []
  // Split on `:` but preserve content inside `[...]` (arbitrary values)
  const parts = splitColons(s)
  while (parts.length > 1) {
    const candidate = parts[0]
    if (MODIFIERS.has(candidate as Modifier)) {
      modifiers.push(candidate as Modifier)
      parts.shift()
    } else {
      break
    }
  }
  const utility = parts.join(':')
  return { raw, modifiers, utility, important }
}

function splitColons(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of s) {
    if (ch === '[') depth++
    else if (ch === ']') depth--
    if (ch === ':' && depth === 0) {
      out.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  out.push(buf)
  return out
}

export function joinUnused(classes: ParsedClass[]): string {
  return classes.map((c) => c.raw).join(' ')
}
