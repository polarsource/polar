import { describe, expect, test } from 'vitest'
import { generateFormula } from './homebrew'

const checksums = [
  `${'a'.repeat(64)}  polar-darwin-arm64.zip`,
  `${'b'.repeat(64)}  polar-darwin-x64.zip`,
  `${'c'.repeat(64)}  polar-linux-x64.tar.gz`,
  `${'e'.repeat(64)}  polar-linux-arm64.tar.gz`,
].join('\n')

describe('Homebrew formula generation', () => {
  test('pins platform archives and checksums to the requested release', () => {
    const formula = generateFormula('@polar-sh/cli@2.0.1', checksums)
    expect(formula).toContain('version "2.0.1"')
    expect(formula).toContain('/releases/download/%40polar-sh%2Fcli%402.0.1/')
    for (const line of checksums.split('\n')) {
      const [hash, archive] = line.split('  ')
      expect(formula).toContain(`sha256 "${hash}"`)
      expect(formula).toContain(
        `/releases/download/%40polar-sh%2Fcli%402.0.1/${archive}`,
      )
    }
    expect(formula).toContain('polar-linux-arm64.tar.gz')
  })

  test('rejects prereleases and untrusted tag text', () => {
    for (const tag of [
      '@polar-sh/cli@2.0.1-beta.1',
      '@polar-sh/cli-verify-1-1',
      '@polar-sh/ui@2.0.1',
      'v2.0.1',
      'main',
      '@polar-sh/cli@2.0.1"\nend',
    ]) {
      expect(() => generateFormula(tag, checksums)).toThrow(
        'stable release tag',
      )
    }
  })

  test('fails if any supported platform has no checksum', () => {
    for (const line of checksums.split('\n')) {
      expect(() =>
        generateFormula('@polar-sh/cli@2.0.1', checksums.replace(line, '')),
      ).toThrow()
    }
  })

  test('rejects malformed and duplicate checksums', () => {
    expect(() =>
      generateFormula('@polar-sh/cli@2.0.1', checksums.replace('a', 'z')),
    ).toThrow('Invalid checksum')
    expect(() =>
      generateFormula('@polar-sh/cli@2.0.1', `${checksums}\n${checksums}`),
    ).toThrow('Duplicate checksum')
  })

  test('accepts sha256sum binary markers, CRLF and extra release assets', () => {
    const text = `${checksums.replaceAll('  ', ' *').replaceAll('\n', '\r\n')}\r\n${'d'.repeat(64)} *polar-windows-x64.zip\r\n`
    expect(generateFormula('@polar-sh/cli@2.0.1', text)).toBe(
      generateFormula('@polar-sh/cli@2.0.1', checksums),
    )
  })
})
