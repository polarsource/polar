import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isHomebrewInstallation } from '@/services/installation'

describe('Homebrew installation detection', () => {
  let directory: string
  let binary: string
  let keg: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'polar-installation-'))
    keg = join(directory, 'custom-cellar', 'polar', '2.0.1')
    binary = join(keg, 'bin', 'polar')
    await mkdir(join(keg, 'bin'), { recursive: true })
    await writeFile(binary, 'binary')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  test('detects a keg through a symlink with a custom Homebrew prefix', async () => {
    await writeFile(join(keg, 'INSTALL_RECEIPT.json'), '{}')
    const link = join(directory, 'polar')
    await symlink(binary, link)
    expect(isHomebrewInstallation(binary)).toBe(true)
    expect(isHomebrewInstallation(link)).toBe(true)
  })

  test('does not classify a standalone binary as Homebrew', () => {
    expect(isHomebrewInstallation(binary)).toBe(false)
  })

  test('does not classify a Homebrew-installed Bun running the source CLI as Polar', async () => {
    const bun = join(keg, 'bin', 'bun')
    await writeFile(bun, 'binary')
    await writeFile(join(keg, 'INSTALL_RECEIPT.json'), '{}')
    expect(isHomebrewInstallation(bun)).toBe(false)
  })

  test('handles a missing binary without throwing', () => {
    expect(isHomebrewInstallation(join(directory, 'missing'))).toBe(false)
  })
})
