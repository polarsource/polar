import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { formatTypescript } from './typescript.js'
import type { FlatTokenMap, ResolvedToken, ThemeConfig } from '../types.js'

function makeMap(tokens: Partial<ResolvedToken>[]): FlatTokenMap {
  const map: FlatTokenMap = new Map()
  for (const t of tokens) {
    const token: ResolvedToken = {
      path: t.path ?? 'test',
      rawPath: t.rawPath ?? ['test'],
      value: t.value ?? '',
      type: t.type ?? 'color',
      aliasOf: t.aliasOf,
      themeValues: t.themeValues,
    }
    map.set(token.rawPath.join('.'), token)
  }
  return map
}

describe('formatTypescript', () => {
  // ── Base tokens export ────────────────────────────────────────────────

  it('starts with "export const tokens ="', () => {
    const output = Effect.runSync(formatTypescript(makeMap([{ rawPath: ['c'], value: '#fff', type: 'color' }])))
    expect(output.trimStart().startsWith('export const tokens =')).toBe(true)
  })

  it('ends with "as const"', () => {
    const output = Effect.runSync(formatTypescript(makeMap([{ rawPath: ['c'], value: '#fff', type: 'color' }])))
    expect(output.trim()).toMatch(/as const\s*$/)
  })

  it('nests tokens by rawPath', () => {
    const map = makeMap([
      { rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
    ])
    const output = Effect.runSync(formatTypescript(map))
    expect(output).toContain('"colors"')
    expect(output).toContain('"primary"')
    expect(output).toContain('"#0066ff"')
  })

  it('uses concrete values (not var()) regardless of aliasOf', () => {
    const map = makeMap([
      { rawPath: ['btn', 'bg'], value: '#0066ff', aliasOf: 'colors.primary', type: 'color' },
    ])
    const output = Effect.runSync(formatTypescript(map))
    expect(output).toContain('"#0066ff"')
    expect(output).not.toContain('var(')
  })

  it('handles empty map', () => {
    const output = Effect.runSync(formatTypescript(new Map()))
    expect(output.trim()).toContain('export const tokens = {} as const')
  })

  it('handles numeric values unquoted', () => {
    const map = makeMap([{ rawPath: ['weight'], value: 700, type: 'fontWeight' }])
    const output = Effect.runSync(formatTypescript(map))
    expect(output).toContain('700')
    expect(output).not.toContain('"700"')
  })

  // ── Themes export ─────────────────────────────────────────────────────

  it('does not emit themes export when no themes config', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#fff',
        themeValues: { dark: { value: '#000' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatTypescript(map))
    expect(output).not.toContain('export const themes')
  })

  it('emits export const themes when themes config provided and overrides exist', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatTypescript(map, themes))
    expect(output).toContain('export const themes =')
    expect(output).toMatch(/themes.*as const/s)
  })

  it('themes export is nested by rawPath', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        rawPath: ['button', 'background'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatTypescript(map, themes))
    expect(output).toContain('"dark"')
    expect(output).toContain('"button"')
    expect(output).toContain('"background"')
    expect(output).toContain('"#1a1a2e"')
  })

  it('omits themes export when themes provided but no overrides exist', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([{ rawPath: ['a'], value: '#fff', type: 'color' }])
    const output = Effect.runSync(formatTypescript(map, themes))
    expect(output).not.toContain('export const themes')
  })

  it('includes multiple themes', () => {
    const themes: ThemeConfig = { dark: ':root .dark', 'high-contrast': ':root .hc' }
    const map = makeMap([
      {
        rawPath: ['btn'],
        value: '#fff',
        themeValues: {
          dark: { value: '#000' },
          'high-contrast': { value: '#111' },
        },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatTypescript(map, themes))
    expect(output).toContain('"dark"')
    expect(output).toContain('"high-contrast"')
  })
})
