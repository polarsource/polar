import { Effect } from 'effect'
import { describe, it, expect } from 'vitest'
import { resolveAliases, ResolveError } from './aliases.js'
import type { TokenGroup } from '../types.js'

describe('resolveAliases', () => {
  // ── Base token resolution ──────────────────────────────────────────────

  it('flattens a simple token group', () => {
    const group: TokenGroup = {
      colors: {
        primary: { $value: '#0066ff', $type: 'color' },
        secondary: { $value: '#6b7280', $type: 'color' },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.size).toBe(2)
    expect(map.get('colors.primary')?.value).toBe('#0066ff')
    expect(map.get('colors.secondary')?.value).toBe('#6b7280')
  })

  it('resolves simple aliases', () => {
    const group: TokenGroup = {
      colors: {
        primary: { $value: '#0066ff', $type: 'color' },
        accent: { $value: '{colors.primary}', $type: 'color' },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('colors.accent')?.value).toBe('#0066ff')
  })

  it('resolves chained aliases', () => {
    const group: TokenGroup = {
      base: { $value: '#ff0000', $type: 'color' },
      alias1: { $value: '{base}', $type: 'color' },
      alias2: { $value: '{alias1}', $type: 'color' },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('alias2')?.value).toBe('#ff0000')
  })

  it('inherits $type from parent group', () => {
    const group: TokenGroup = {
      colors: {
        $type: 'color',
        primary: { $value: '#0066ff' },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('colors.primary')?.type).toBe('color')
  })

  it('token-level $type overrides group $type', () => {
    const group: TokenGroup = {
      tokens: {
        $type: 'color',
        size: { $value: '16px', $type: 'dimension' },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('tokens.size')?.type).toBe('dimension')
  })

  it('includes description when present', () => {
    const group: TokenGroup = {
      primary: {
        $value: '#0066ff',
        $type: 'color',
        $description: 'Brand blue',
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('primary')?.description).toBe('Brand blue')
  })

  it('produces correct path and rawPath', () => {
    const group: TokenGroup = {
      colors: {
        text: {
          default: { $value: '#111827', $type: 'color' },
        },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    const token = map.get('colors.text.default')!
    expect(token.path).toBe('colors-text-default')
    expect(token.rawPath).toEqual(['colors', 'text', 'default'])
  })

  it('fails with ResolveError for unknown alias', () => {
    const group: TokenGroup = {
      bad: { $value: '{nonexistent.path}', $type: 'color' },
    }
    const result = Effect.runSyncExit(resolveAliases(group))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(ResolveError)
    }
  })

  it('fails with ResolveError for circular aliases', () => {
    const group: TokenGroup = {
      a: { $value: '{b}', $type: 'color' },
      b: { $value: '{a}', $type: 'color' },
    }
    const result = Effect.runSyncExit(resolveAliases(group))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(ResolveError)
    }
  })

  it('handles empty token group', () => {
    const map = Effect.runSync(resolveAliases({}))
    expect(map.size).toBe(0)
  })

  it('skips $ keys at any level', () => {
    const group: TokenGroup = {
      $type: 'color',
      $description: 'Root group',
      primary: { $value: '#0066ff', $type: 'color' },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.size).toBe(1)
    expect(map.has('primary')).toBe(true)
  })

  // ── aliasOf tracking ───────────────────────────────────────────────────

  it('sets aliasOf to the direct alias dot-path', () => {
    const group: TokenGroup = {
      colors: {
        primary: { $value: '#0066ff', $type: 'color' },
        accent: { $value: '{colors.primary}', $type: 'color' },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('colors.primary')?.aliasOf).toBeUndefined()
    expect(map.get('colors.accent')?.aliasOf).toBe('colors.primary')
  })

  it('aliasOf is the direct (one-hop) source in a chain', () => {
    // accent → primary → base: accent.aliasOf should be 'primary', not 'base'
    const group: TokenGroup = {
      base: { $value: '#ff0000', $type: 'color' },
      primary: { $value: '{base}', $type: 'color' },
      accent: { $value: '{primary}', $type: 'color' },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('accent')?.aliasOf).toBe('primary')
    expect(map.get('primary')?.aliasOf).toBe('base')
  })

  it('does not set aliasOf for literal tokens', () => {
    const group: TokenGroup = {
      primary: { $value: '#0066ff', $type: 'color' },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('primary')?.aliasOf).toBeUndefined()
  })

  // ── $themes (component tokens) ─────────────────────────────────────────

  it('resolves $themes values to concrete values', () => {
    const group: TokenGroup = {
      colors: { primary: { $value: '#0066ff', $type: 'color' } },
      button: {
        background: {
          $value: '{colors.primary}',
          $type: 'color',
          $themes: { dark: '#1a1a2e' },
        },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    const token = map.get('button.background')!
    expect(token.themeValues?.['dark']?.value).toBe('#1a1a2e')
  })

  it('resolves $themes alias values', () => {
    const group: TokenGroup = {
      colors: {
        primary: { $value: '#0066ff', $type: 'color' },
        secondary: { $value: '#6b7280', $type: 'color' },
      },
      button: {
        background: {
          $value: '{colors.primary}',
          $type: 'color',
          $themes: { dark: '{colors.secondary}' },
        },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    const token = map.get('button.background')!
    expect(token.themeValues?.['dark']?.value).toBe('#6b7280')
    expect(token.themeValues?.['dark']?.aliasOf).toBe('colors.secondary')
  })

  it('supports multiple themes on one token', () => {
    const group: TokenGroup = {
      colors: {
        primary: { $value: '#0066ff', $type: 'color' },
        secondary: { $value: '#6b7280', $type: 'color' },
        danger: { $value: '#ef4444', $type: 'color' },
      },
      button: {
        background: {
          $value: '{colors.primary}',
          $type: 'color',
          $themes: {
            dark: '{colors.secondary}',
            danger: '{colors.danger}',
          },
        },
      },
    }
    const map = Effect.runSync(resolveAliases(group))
    const token = map.get('button.background')!
    expect(token.themeValues?.['dark']?.value).toBe('#6b7280')
    expect(token.themeValues?.['danger']?.value).toBe('#ef4444')
  })

  it('$themes literal value has no aliasOf', () => {
    const group: TokenGroup = {
      btn: { $value: '#fff', $type: 'color', $themes: { dark: '#000' } },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('btn')?.themeValues?.['dark']?.aliasOf).toBeUndefined()
    expect(map.get('btn')?.themeValues?.['dark']?.value).toBe('#000')
  })

  it('fails with ResolveError when $themes references unknown alias', () => {
    const group: TokenGroup = {
      btn: { $value: '#fff', $type: 'color', $themes: { dark: '{nonexistent}' } },
    }
    const result = Effect.runSyncExit(resolveAliases(group))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(ResolveError)
    }
  })

  it('fails with ResolveError for cycle involving $themes', () => {
    const group: TokenGroup = {
      a: { $value: '#fff', $type: 'color', $themes: { dark: '{b}' } },
      b: { $value: '#000', $type: 'color', $themes: { dark: '{a}' } },
    }
    const result = Effect.runSyncExit(resolveAliases(group))
    // This would produce a cycle in the dependency graph
    expect(result._tag).toBe('Failure')
  })

  it('tokens without $themes have no themeValues', () => {
    const group: TokenGroup = {
      primary: { $value: '#0066ff', $type: 'color' },
    }
    const map = Effect.runSync(resolveAliases(group))
    expect(map.get('primary')?.themeValues).toBeUndefined()
  })
})
