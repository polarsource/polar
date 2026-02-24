import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import type { TokenGroup } from '../types.js'
import { TokenNameValidationError, validateTokenNames } from './token-names.js'

describe('validateTokenNames', () => {
  it('accepts uppercase alphanumeric token keys with underscores', () => {
    const group: TokenGroup = {
      COLORS: {
        BG_SURFACE: { value: '#ffffff', type: 'color' },
      },
      SPACING: {
        SPACING_2: { value: '16px', type: 'dimension' },
      },
      RADII: {
        '2XL': { value: '32px', type: 'dimension' },
      },
    }

    const result = Effect.runSyncExit(validateTokenNames(group))
    expect(result._tag).toBe('Success')
  })

  it('fails on lowercase token key', () => {
    const group: TokenGroup = {
      COLORS: {
        bg: { value: '#ffffff', type: 'color' },
      },
    }

    const result = Effect.runSyncExit(validateTokenNames(group))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(TokenNameValidationError)
      expect(result.cause.error.path).toBe('COLORS.bg')
    }
  })

  it('fails on spaces and reports full path', () => {
    const group: TokenGroup = {
      COLORS: {
        'BG SURFACE': { value: '#ffffff', type: 'color' },
      },
    }

    const result = Effect.runSyncExit(validateTokenNames(group))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure' && result.cause._tag === 'Fail') {
      expect(result.cause.error).toBeInstanceOf(TokenNameValidationError)
      expect(result.cause.error.path).toBe('COLORS.BG SURFACE')
      expect(result.cause.error.message).toContain('underscores only')
    }
  })

  it('ignores metadata keys and theme names', () => {
    const group: TokenGroup = {
      COLORS: {
        BG: {
          value: '#ffffff',
          themes: {
            dark: '#000000',
          },
        },
      },
    }

    const result = Effect.runSyncExit(validateTokenNames(group))
    expect(result._tag).toBe('Success')
  })
})
