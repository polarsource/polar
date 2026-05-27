import { describe, expect, it, vi } from 'vitest'

vi.mock('@stylexjs/stylex', () => ({
  default: {
    defineVars: <T extends Record<string, unknown>>(obj: T) => obj,
    defineConsts: <T extends Record<string, unknown>>(obj: T) => obj,
    create: <T extends Record<string, unknown>>(obj: T) => obj,
    props: () => ({ className: '', style: {} }),
  },
  defineVars: <T extends Record<string, unknown>>(obj: T) => obj,
  defineConsts: <T extends Record<string, unknown>>(obj: T) => obj,
  create: <T extends Record<string, unknown>>(obj: T) => obj,
  props: () => ({ className: '', style: {} }),
}))

const { resolveBoxStyles } = await import('./resolvers')

describe('resolveBoxStyles — responsive path translates short values to CSS', () => {
  it('justifyContent: between → space-between', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { justifyContent: { md: 'between' } },
      'scope',
    )
    expect(responsiveCSS).toContain('space-between')
    expect(responsiveCSS).not.toMatch(/justify-content:\s*between/)
  })

  it('justifyContent: around → space-around', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { justifyContent: { md: 'around' } },
      'scope',
    )
    expect(responsiveCSS).toContain('space-around')
    expect(responsiveCSS).not.toMatch(/justify-content:\s*around/)
  })

  it('justifyContent: evenly → space-evenly', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { justifyContent: { md: 'evenly' } },
      'scope',
    )
    expect(responsiveCSS).toContain('space-evenly')
    expect(responsiveCSS).not.toMatch(/justify-content:\s*evenly/)
  })

  it('alignItems: start/end → flex-start/flex-end', () => {
    const start = resolveBoxStyles(
      { alignItems: { md: 'start' } },
      'scope',
    ).responsiveCSS
    const end = resolveBoxStyles(
      { alignItems: { md: 'end' } },
      'scope',
    ).responsiveCSS
    expect(start).toContain('flex-start')
    expect(end).toContain('flex-end')
    expect(start).not.toMatch(/align-items:\s*start\b/)
    expect(end).not.toMatch(/align-items:\s*end\b/)
  })

  it('alignSelf: start/end → flex-start/flex-end', () => {
    const start = resolveBoxStyles(
      { alignSelf: { md: 'start' } },
      'scope',
    ).responsiveCSS
    const end = resolveBoxStyles(
      { alignSelf: { md: 'end' } },
      'scope',
    ).responsiveCSS
    expect(start).toContain('flex-start')
    expect(end).toContain('flex-end')
    expect(start).not.toMatch(/align-self:\s*start\b/)
    expect(end).not.toMatch(/align-self:\s*end\b/)
  })

  it('alignContent: between → space-between, start → flex-start', () => {
    const between = resolveBoxStyles(
      { alignContent: { md: 'between' } },
      'scope',
    ).responsiveCSS
    const start = resolveBoxStyles(
      { alignContent: { md: 'start' } },
      'scope',
    ).responsiveCSS
    expect(between).toContain('space-between')
    expect(start).toContain('flex-start')
    expect(between).not.toMatch(/align-content:\s*between/)
    expect(start).not.toMatch(/align-content:\s*start\b/)
  })

  it('passes already-valid values through unchanged', () => {
    const { responsiveCSS } = resolveBoxStyles(
      {
        justifyContent: { md: 'center' },
        alignItems: { md: 'center' },
      },
      'scope',
    )
    expect(responsiveCSS).toContain('justify-content: center')
    expect(responsiveCSS).toContain('align-items: center')
  })
})

describe('resolveBoxStyles — pseudo-state path also translates', () => {
  it('justifyContent hover: between → space-between', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { justifyContent: { hover: 'between' } },
      'scope',
    )
    expect(responsiveCSS).toContain('space-between')
    expect(responsiveCSS).not.toMatch(/justify-content:\s*between/)
  })
})

describe('addTokenProp — scalar values', () => {
  it('padding scalar adds the matching style to stylexStyles', () => {
    const { stylexStyles, responsiveCSS } = resolveBoxStyles(
      { padding: 's' },
      'scope',
    )
    expect(stylexStyles).toHaveLength(1)
    expect(stylexStyles[0]).toEqual({ padding: '8px' })
    expect(responsiveCSS).toBeNull()
  })

  it('multiple token props each push their own style', () => {
    const { stylexStyles } = resolveBoxStyles(
      { padding: 's', backgroundColor: 'background-card', borderRadius: 'l' },
      'scope',
    )
    expect(stylexStyles).toHaveLength(3)
  })

  it('long form (padding) takes precedence over shorthand (p)', () => {
    const { stylexStyles } = resolveBoxStyles(
      { padding: 's', p: 'xl' },
      'scope',
    )
    expect(stylexStyles).toEqual([{ padding: '8px' }])
  })

  it('shorthand (p) is used when long form is undefined', () => {
    const { stylexStyles } = resolveBoxStyles({ p: 'm' }, 'scope')
    expect(stylexStyles).toEqual([{ padding: '12px' }])
  })

  it('display/overflow scalar values map through', () => {
    const { stylexStyles } = resolveBoxStyles(
      { display: 'flex', overflow: 'hidden' },
      'scope',
    )
    expect(stylexStyles).toEqual(
      expect.arrayContaining([{ display: 'flex' }, { overflow: 'hidden' }]),
    )
  })

  it('undefined value is a no-op', () => {
    const { stylexStyles, inlineStyle, responsiveCSS } = resolveBoxStyles(
      { padding: undefined },
      'scope',
    )
    expect(stylexStyles).toHaveLength(0)
    expect(inlineStyle).toEqual({})
    expect(responsiveCSS).toBeNull()
  })

  it('unknown token (not in style map) is silently dropped', () => {
    const { stylexStyles } = resolveBoxStyles(
      { padding: 'not-a-real-token' as 's' },
      'scope',
    )
    expect(stylexStyles).toHaveLength(0)
  })
})

describe('addTokenProp — responsive base goes to stylexStyles, not CSS', () => {
  it('{ base: X } pushes the same style as scalar X', () => {
    const a = resolveBoxStyles({ padding: { base: 'l' } }, 'scope')
    const b = resolveBoxStyles({ padding: 'l' }, 'scope')
    expect(a.stylexStyles).toEqual(b.stylexStyles)
    expect(a.responsiveCSS).toBeNull()
  })
})

describe('addTokenProp — breakpoint variants', () => {
  it('padding md generates @media rule with translated px value', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { md: 'l' } },
      'scope',
    )
    expect(responsiveCSS).toContain('@media (min-width: 768px)')
    expect(responsiveCSS).toContain('padding: 16px')
  })

  it('breakpoints are emitted in ascending order', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { lg: 'xl', sm: 's' } },
      'scope',
    )
    const smPos = responsiveCSS!.indexOf('min-width: 640px')
    const lgPos = responsiveCSS!.indexOf('min-width: 1024px')
    expect(smPos).toBeGreaterThan(-1)
    expect(lgPos).toBeGreaterThan(smPos)
  })

  it('unknown breakpoint key is silently dropped', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { bogus: 's' } as unknown as { md: 's' } },
      'scope',
    )
    expect(responsiveCSS).toBeNull()
  })

  it('multiple props at the same breakpoint share one @media rule', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { md: 'l' }, gap: { md: 's' } },
      'scope',
    )
    const mediaRules = responsiveCSS!.match(/@media \(min-width: 768px\)/g)
    expect(mediaRules).toHaveLength(1)
    expect(responsiveCSS).toContain('padding: 16px')
    expect(responsiveCSS).toContain('gap: 8px')
  })

  it('padding-top wins over padding-block at the same breakpoint', () => {
    const { responsiveCSS } = resolveBoxStyles(
      {
        paddingVertical: { md: 'l' },
        paddingTop: { md: 'none' },
      },
      'scope',
    )
    expect(responsiveCSS).toContain('@media (min-width: 768px)')
    const mdMatch = responsiveCSS!.match(
      /@media \(min-width: 768px\) \{[^}]+\}/,
    )
    expect(mdMatch).toBeTruthy()
    const block = mdMatch![0]
    expect(block.indexOf('padding-block')).toBeLessThan(
      block.indexOf('padding-top'),
    )
    expect(block).toContain('padding-top: 0')
  })
})

describe('addTokenProp — token-CSS translations', () => {
  it('borderRadius emits radius token value', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { borderRadius: { md: 'l' } },
      'scope',
    )
    expect(responsiveCSS).toContain('border-radius: 16px')
  })

  it('boxShadow scalar pushes the matching style', () => {
    const { stylexStyles } = resolveBoxStyles({ boxShadow: 'm' }, 'scope')
    expect(stylexStyles).toHaveLength(1)
  })

  it('boxShadow responsive emits a box-shadow value', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { boxShadow: { md: 'l' } },
      'scope',
    )
    expect(responsiveCSS).toMatch(/box-shadow:\s*\S+/)
  })

  it('backgroundColor responsive emits a color value', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { backgroundColor: { md: 'background-card' } },
      'scope',
    )

    expect(responsiveCSS).toMatch(/background-color:\s*\S+/)
  })
})

describe('addTokenProp — margin "auto" special case', () => {
  it('margin: auto in responsive value emits literal "auto"', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { margin: { md: 'auto' } },
      'scope',
    )
    expect(responsiveCSS).toContain('margin: auto')
  })

  it('margin token (non-auto) translates to spacing value', () => {
    const { responsiveCSS } = resolveBoxStyles({ margin: { md: 'l' } }, 'scope')
    expect(responsiveCSS).toContain('margin: 16px')
  })
})

describe('addArbitraryProp — scalar values go to inlineStyle', () => {
  it('width number → "Npx"', () => {
    const { inlineStyle } = resolveBoxStyles({ width: 100 }, 'scope')
    expect(inlineStyle.width).toBe('100px')
  })

  it('width 0 → "0" (no px suffix)', () => {
    const { inlineStyle } = resolveBoxStyles({ width: 0 }, 'scope')
    expect(inlineStyle.width).toBe('0')
  })

  it('width string passes through unchanged', () => {
    const { inlineStyle } = resolveBoxStyles({ width: '50vh' }, 'scope')
    expect(inlineStyle.width).toBe('50vh')
  })

  it('opacity number stays numeric (unitless)', () => {
    const { inlineStyle } = resolveBoxStyles({ opacity: 0.5 }, 'scope')
    expect(inlineStyle.opacity).toBe(0.5)
  })

  it('zIndex number stays numeric', () => {
    const { inlineStyle } = resolveBoxStyles({ zIndex: 10 }, 'scope')
    expect(inlineStyle.zIndex).toBe(10)
  })

  it('negative top → "-Npx"', () => {
    const { inlineStyle } = resolveBoxStyles({ top: -10 }, 'scope')
    expect(inlineStyle.top).toBe('-10px')
  })

  it('flex numeric expands to "N N 0%"', () => {
    const { inlineStyle } = resolveBoxStyles({ flex: 2 }, 'scope')
    expect(inlineStyle.flex).toBe('2 2 0%')
  })

  it('flex string passes through (no expansion)', () => {
    const { inlineStyle } = resolveBoxStyles({ flex: '1 1 auto' }, 'scope')
    expect(inlineStyle.flex).toBe('1 1 auto')
  })

  it('aspectRatio passes through unchanged', () => {
    const { inlineStyle } = resolveBoxStyles({ aspectRatio: '16 / 9' }, 'scope')
    expect(inlineStyle.aspectRatio).toBe('16 / 9')
  })

  it('borderWidth scalar emits "Npx"', () => {
    const { inlineStyle } = resolveBoxStyles({ borderWidth: 2 }, 'scope')
    expect(inlineStyle.borderWidth).toBe('2px')
  })
})

describe('addArbitraryProp — { base: X } goes to scoped <style>, not inline', () => {
  it('width base writes to responsiveCSS (no @media), inlineStyle is empty', () => {
    const { inlineStyle, responsiveCSS } = resolveBoxStyles(
      { width: { base: 100 } },
      'scope',
    )
    expect(inlineStyle).toEqual({})
    expect(responsiveCSS).toContain('width: 100px')
    expect(responsiveCSS).not.toContain('@media')
  })

  it('width with base + breakpoint: base in scoped rule, lg in @media', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { width: { base: 100, lg: 500 } },
      'scope',
    )
    expect(responsiveCSS).toContain('width: 100px')
    expect(responsiveCSS).toContain('@media (min-width: 1024px)')
    expect(responsiveCSS).toContain('width: 500px')
  })

  it('width hover state writes a :hover rule', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { width: { hover: 200 } },
      'scope',
    )
    expect(responsiveCSS).toContain(':hover')
    expect(responsiveCSS).toContain('width: 200px')
  })

  it('flex numeric expansion still applies in responsive value', () => {
    const { responsiveCSS } = resolveBoxStyles({ flex: { md: 3 } }, 'scope')
    expect(responsiveCSS).toContain('flex: 3 3 0%')
  })

  it('grid-template-columns arbitrary value', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { gridTemplateColumns: { md: 'repeat(3, 1fr)' } },
      'scope',
    )
    expect(responsiveCSS).toContain('grid-template-columns: repeat(3, 1fr)')
  })
})

describe('CSS string builder', () => {
  it('uses StyleX-beating specificity selector (×4 :not)', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { md: 'l' } },
      'myScope',
    )
    expect(responsiveCSS).toContain(
      '.myScope:not(#\\#):not(#\\#):not(#\\#):not(#\\#)',
    )
  })

  it('mixes token + arbitrary props at the same breakpoint into one rule', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { md: 'l' }, width: { md: 100 } },
      'scope',
    )
    const mediaRules = responsiveCSS!.match(/@media \(min-width: 768px\)/g)
    expect(mediaRules).toHaveLength(1)
    expect(responsiveCSS).toContain('padding: 16px')
    expect(responsiveCSS).toContain('width: 100px')
  })

  it('multiple pseudo-states each get their own rule', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { hover: 'l', focus: 's' } },
      'scope',
    )
    expect(responsiveCSS).toMatch(/:hover.*padding: 16px/)
    expect(responsiveCSS).toMatch(/:focus.*padding: 8px/)
  })

  it('camelCase keys (zIndex) are converted to kebab-case in output', () => {
    const { responsiveCSS } = resolveBoxStyles({ zIndex: { md: 5 } }, 'scope')
    expect(responsiveCSS).toContain('z-index: 5')
  })

  it('returns null when no responsive/pseudo styles', () => {
    const { responsiveCSS } = resolveBoxStyles({ padding: 's' }, 'scope')
    expect(responsiveCSS).toBeNull()
  })

  it('returns empty result for empty props', () => {
    const { stylexStyles, inlineStyle, responsiveCSS } = resolveBoxStyles(
      {},
      'scope',
    )
    expect(stylexStyles).toHaveLength(0)
    expect(inlineStyle).toEqual({})
    expect(responsiveCSS).toBeNull()
  })
})

describe('responsive object — undefined keys', () => {
  it('skips undefined entries in token responsive object', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { padding: { md: undefined, lg: 'l' } },
      'scope',
    )
    expect(responsiveCSS).not.toContain('768px')
    expect(responsiveCSS).toContain('1024px')
  })

  it('skips undefined entries in arbitrary responsive object', () => {
    const { responsiveCSS } = resolveBoxStyles(
      { width: { md: undefined, lg: 200 } },
      'scope',
    )
    expect(responsiveCSS).not.toContain('768px')
    expect(responsiveCSS).toContain('width: 200px')
  })
})

describe('mixed scenarios', () => {
  it('scalar token + scalar arbitrary + responsive arbitrary all coexist', () => {
    const { stylexStyles, inlineStyle, responsiveCSS } = resolveBoxStyles(
      {
        padding: 'l',
        opacity: 0.8,
        width: { md: 200 },
      },
      'scope',
    )
    expect(stylexStyles).toEqual([{ padding: '16px' }])
    expect(inlineStyle).toEqual({ opacity: 0.8 })
    expect(responsiveCSS).toContain('@media (min-width: 768px)')
    expect(responsiveCSS).toContain('width: 200px')
  })
})
