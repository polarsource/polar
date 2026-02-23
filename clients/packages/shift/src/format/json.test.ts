import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { formatJson } from './json.js'
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

describe('formatJson', () => {
  // ── Base output ──────────────────────────────────────────────────────

  it('produces valid JSON', () => {
    const map = makeMap([
      { rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
    ])
    expect(() => JSON.parse(Effect.runSync(formatJson(map)))).not.toThrow()
  })

  it('nests tokens by rawPath', () => {
    const map = makeMap([
      { rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
      { rawPath: ['colors', 'secondary'], value: '#6b7280', type: 'color' },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map)))
    expect(parsed.colors.primary).toBe('#0066ff')
    expect(parsed.colors.secondary).toBe('#6b7280')
  })

  it('nests deeply', () => {
    const map = makeMap([{ rawPath: ['a', 'b', 'c'], value: 'val', type: 'string' }])
    const parsed = JSON.parse(Effect.runSync(formatJson(map)))
    expect(parsed.a.b.c).toBe('val')
  })

  it('uses concrete values (not var()) regardless of aliasOf', () => {
    const map = makeMap([
      { rawPath: ['btn', 'bg'], value: '#0066ff', aliasOf: 'colors.primary', type: 'color' },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map)))
    expect(parsed.btn.bg).toBe('#0066ff')
  })

  it('handles numeric values', () => {
    const map = makeMap([{ rawPath: ['weight'], value: 700, type: 'fontWeight' }])
    const parsed = JSON.parse(Effect.runSync(formatJson(map)))
    expect(parsed.weight).toBe(700)
  })

  it('handles empty map', () => {
    expect(JSON.parse(Effect.runSync(formatJson(new Map())))).toEqual({})
  })

  // ── Theme output ─────────────────────────────────────────────────────

  it('does not include $themes key when no themes config', () => {
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: { dark: { value: '#000' } },
        type: 'color',
      },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map)))
    expect(parsed['$themes']).toBeUndefined()
  })

  it('includes $themes key when themes config provided and overrides exist', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map, themes)))
    expect(parsed['$themes']).toBeDefined()
    expect(parsed['$themes'].dark.btn.bg).toBe('#1a1a2e')
  })

  it('theme values are nested by rawPath', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        rawPath: ['button', 'background'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map, themes)))
    expect(parsed['$themes'].dark.button.background).toBe('#1a1a2e')
  })

  it('only includes tokens with overrides in theme object', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      { rawPath: ['a'], value: '#fff', type: 'color' },
      { rawPath: ['b'], value: '#000', themeValues: { dark: { value: '#111' } }, type: 'color' },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map, themes)))
    expect(parsed['$themes'].dark.b).toBe('#111')
    expect(parsed['$themes'].dark.a).toBeUndefined()
  })

  it('omits $themes key when themes provided but no token has overrides', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([{ rawPath: ['a'], value: '#fff', type: 'color' }])
    const parsed = JSON.parse(Effect.runSync(formatJson(map, themes)))
    expect(parsed['$themes']).toBeUndefined()
  })

  it('includes multiple themes', () => {
    const themes: ThemeConfig = { dark: ':root .dark', 'high-contrast': ':root .hc' }
    const map = makeMap([
      {
        rawPath: ['btn'],
        value: '#fff',
        themeValues: { dark: { value: '#000' }, 'high-contrast': { value: '#111' } },
        type: 'color',
      },
    ])
    const parsed = JSON.parse(Effect.runSync(formatJson(map, themes)))
    expect(parsed['$themes'].dark.btn).toBe('#000')
    expect(parsed['$themes']['high-contrast'].btn).toBe('#111')
  })
})
