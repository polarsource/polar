import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export const HOMEBREW_UPGRADE_COMMAND = 'brew upgrade polarsource/tap/polar'

export function isHomebrewInstallation(executable = process.execPath): boolean {
  try {
    const resolved = realpathSync(executable)
    return (
      basename(resolved) === 'polar' &&
      existsSync(join(dirname(dirname(resolved)), 'INSTALL_RECEIPT.json'))
    )
  } catch {
    return false
  }
}
