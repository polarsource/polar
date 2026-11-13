import { describe, expect, test } from 'vitest'
import {
  rememberedOut,
  rememberOut,
} from '@/utils/billing-config/generate/settings'

describe('rememberOut', () => {
  test.each([
    [
      'two spaces',
      '{\n  "products": [\n    { "external_id": "pro" }\n  ]\n}\n',
    ],
    ['tabs', '{\n\t"products": [\n\t\t{ "external_id": "pro" }\n\t]\n}\n'],
    [
      'four spaces',
      '{\n    "products": [\n        { "external_id": "pro" }\n    ]\n}\n',
    ],
  ])(
    'adds the path to a config indented with %s and changes nothing else',
    (_, source) => {
      const saved = rememberOut(source, 'src/polar_types.py')
      const indent = /^[ \t]+/m.exec(source)![0]

      expect(rememberedOut(JSON.parse(saved))).toBe('src/polar_types.py')
      expect(saved).toBe(
        source.replace(
          /\n}\n$/,
          `,\n${indent}"generate": {\n${indent}${indent}"out": "src/polar_types.py"\n${indent}}\n}\n`,
        ),
      )
    },
  )

  test('replaces a path saved earlier', () => {
    const source = rememberOut('{\n  "products": []\n}\n', 'a.py')

    expect(rememberedOut(JSON.parse(rememberOut(source, 'b.py')))).toBe('b.py')
  })
})
