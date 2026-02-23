import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { formatCss } from './css.js'
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
      description: t.description,
    }
    map.set(token.rawPath.join('.'), token)
  }
  return map
}

describe('formatCss', () => {
  // ── Base output ──────────────────────────────────────────────────────

  it('wraps output in :root {}', () => {
    const output = Effect.runSync(formatCss(new Map()))
    expect(output).toContain(':root {')
    expect(output).toContain('}')
  })

  it('emits a CSS custom property for each token', () => {
    const map = makeMap([
      { path: 'colors-primary', rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
      { path: 'spacing-md', rawPath: ['spacing', 'md'], value: '16px', type: 'dimension' },
    ])
    const output = Effect.runSync(formatCss(map))
    expect(output).toContain('--colors-primary: #0066ff;')
    expect(output).toContain('--spacing-md: 16px;')
  })

  it('handles empty map', () => {
    const output = Effect.runSync(formatCss(new Map()))
    expect(output).toBe(':root {\n}')
  })

  it('handles numeric values', () => {
    const map = makeMap([{ path: 'weight', rawPath: ['weight'], value: 700, type: 'fontWeight' }])
    const output = Effect.runSync(formatCss(map))
    expect(output).toContain('--weight: 700;')
  })

  // ── Proxy / aliasOf → var() ─────────────────────────────────────────

  it('emits var() for tokens with aliasOf', () => {
    const map = makeMap([
      { path: 'colors-primary', rawPath: ['colors', 'primary'], value: '#0066ff', type: 'color' },
      {
        path: 'button-background',
        rawPath: ['button', 'background'],
        value: '#0066ff',
        aliasOf: 'colors.primary',
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map))
    expect(output).toContain('--button-background: var(--colors-primary);')
    expect(output).toContain('--colors-primary: #0066ff;')
  })

  it('converts dot-path aliasOf to kebab CSS var name', () => {
    const map = makeMap([
      {
        path: 'btn-bg',
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        aliasOf: 'colors.text.default',
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map))
    expect(output).toContain('var(--colors-text-default)')
  })

  // ── Theme blocks ─────────────────────────────────────────────────────

  it('emits no theme block when themes config is omitted', () => {
    const map = makeMap([
      {
        path: 'btn-bg',
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map))
    expect(output).not.toContain('.dark')
  })

  it('emits :root .dark block for dark theme', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        path: 'btn-bg',
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: { dark: { value: '#1a1a2e' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    expect(output).toContain(':root .dark {')
    expect(output).toContain('--btn-bg: #1a1a2e;')
  })

  it('theme block uses var() for aliased theme values', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      {
        path: 'btn-bg',
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        aliasOf: 'colors.primary',
        themeValues: { dark: { value: '#6b7280', aliasOf: 'colors.secondary' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    expect(output).toContain(':root .dark {')
    expect(output).toContain('--btn-bg: var(--colors-secondary);')
  })

  it('theme block only includes tokens that have that theme override', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      { path: 'a', rawPath: ['a'], value: '#fff', type: 'color' },
      {
        path: 'b',
        rawPath: ['b'],
        value: '#000',
        themeValues: { dark: { value: '#111' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    const darkBlock = output.split('\n\n').find((b) => b.includes('.dark'))!
    expect(darkBlock).toContain('--b:')
    expect(darkBlock).not.toContain('--a:')
  })

  it('omits theme block entirely when no tokens have overrides for that theme', () => {
    const themes: ThemeConfig = { dark: ':root .dark' }
    const map = makeMap([
      { path: 'a', rawPath: ['a'], value: '#fff', type: 'color' },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    expect(output).not.toContain('.dark')
  })

  it('emits multiple theme blocks', () => {
    const themes: ThemeConfig = {
      dark: ':root .dark',
      'high-contrast': ':root .high-contrast',
    }
    const map = makeMap([
      {
        path: 'btn-bg',
        rawPath: ['btn', 'bg'],
        value: '#0066ff',
        themeValues: {
          dark: { value: '#1a1a2e' },
          'high-contrast': { value: '#000000' },
        },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    expect(output).toContain(':root .dark {')
    expect(output).toContain(':root .high-contrast {')
  })

  it('uses custom selectors from ThemeConfig', () => {
    const themes: ThemeConfig = { dark: '[data-theme="dark"]' }
    const map = makeMap([
      {
        path: 'bg',
        rawPath: ['bg'],
        value: '#fff',
        themeValues: { dark: { value: '#000' } },
        type: 'color',
      },
    ])
    const output = Effect.runSync(formatCss(map, themes))
    expect(output).toContain('[data-theme="dark"] {')
  })
})
