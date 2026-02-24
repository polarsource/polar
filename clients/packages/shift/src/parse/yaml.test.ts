import { Effect } from 'effect'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseYamlFile, ParseError } from './yaml.js'

function withTempFiles(
  files: Record<string, string>,
  cb: (rootFile: string, dir: string) => void,
) {
  const dir = mkdtempSync(join(tmpdir(), 'shift-test-'))
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(dir, path), content, 'utf-8')
  }
  cb(join(dir, 'tokens.yaml'), dir)
}

describe('parseYamlFile', () => {
  it('parses a valid token document', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  COLORS__PRIMARY:
    value: "#0066ff"
    type: color
imports: []
`,
      },
      (file) => {
        const result = Effect.runSync(parseYamlFile(file))
        expect(result).toMatchObject({
          COLORS__PRIMARY: { value: '#0066ff', type: 'color' },
        })
      },
    )
  })

  it('applies global defaults to local document tokens', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  SPACING__BASE:
    value: "16px"
imports: []
global:
  type: dimension
  category: layout
`,
      },
      (file) => {
        const result = Effect.runSync(parseYamlFile(file))
        expect((result as any).SPACING__BASE.type).toBe('dimension')
        expect((result as any).SPACING__BASE.category).toBe('layout')
      },
    )
  })

  it('parses structured color and dimension values', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  COLORS__FG:
    type: color
    value:
      colorSpace: srgb
      components: [0.467, 0.467, 0.467]
  SPACING__HALF:
    type: dimension
    value:
      value: 0.5
      unit: rem
imports: []
`,
      },
      (file) => {
        const result = Effect.runSync(parseYamlFile(file))
        expect((result as any).COLORS__FG.value.colorSpace).toBe('srgb')
        expect((result as any).SPACING__HALF.value.value).toBe(0.5)
        expect((result as any).SPACING__HALF.value.unit).toBe('rem')
      },
    )
  })

  it('loads imported token documents and merges them for alias resolution/hoisting', () => {
    withTempFiles(
      {
        'base.yaml': `
props:
  COLORS__PRIMARY:
    value: "#0066ff"
    type: color
imports: []
`,
        'tokens.yaml': `
props:
  BUTTON__BACKGROUND:
    value: "{COLORS.PRIMARY}"
    type: color
imports:
  - "./base.yaml"
`,
      },
      (file) => {
        const result = Effect.runSync(parseYamlFile(file))
        expect((result as any).COLORS__PRIMARY.value).toBe('#0066ff')
        expect((result as any).BUTTON__BACKGROUND.value).toBe('{COLORS.PRIMARY}')
      },
    )
  })

  it('returns ParseError for a missing file', () => {
    const result = Effect.runSyncExit(parseYamlFile('/nonexistent/file.yaml'))
    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = result.cause
      expect(error._tag).toBe('Fail')
      if (error._tag === 'Fail') {
        expect(error.error).toBeInstanceOf(ParseError)
        expect((error.error as ParseError).file).toBe('/nonexistent/file.yaml')
      }
    }
  })

  it('fails when top-level schema is invalid', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  COLORS__PRIMARY:
    value: "#0066ff"
imports: []
extra: true
`,
      },
      (file) => {
        const result = Effect.runSyncExit(parseYamlFile(file))
        expect(result._tag).toBe('Failure')
      },
    )
  })

  it('fails when imports contains an absolute path', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  COLORS__PRIMARY:
    value: "#0066ff"
imports:
  - "/tmp/base.yaml"
`,
      },
      (file) => {
        const result = Effect.runSyncExit(parseYamlFile(file))
        expect(result._tag).toBe('Failure')
      },
    )
  })

  it('fails when props contains grouped definitions', () => {
    withTempFiles(
      {
        'tokens.yaml': `
props:
  STATUS:
    NEUTRAL:
      value: "#fff"
imports: []
`,
      },
      (file) => {
        const result = Effect.runSyncExit(parseYamlFile(file))
        expect(result._tag).toBe('Failure')
      },
    )
  })
})
