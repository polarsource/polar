#!/usr/bin/env node

import childProcess from 'node:child_process'
import console from 'node:console'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
)
const command = Object.keys(manifest.bin ?? {})[0]
if (!command) throw new Error(`${manifest.name} does not declare a binary`)

const platform =
  { darwin: 'darwin', linux: 'linux', win32: 'windows' }[os.platform()] ??
  os.platform()
const arch = { x64: 'x64', arm64: 'arm64' }[os.arch()] ?? os.arch()
const sourceBinary = platform === 'windows' ? `${command}.exe` : command
const targetBinary = path.resolve(directory, manifest.bin[command])
const dependencies = manifest.optionalDependencies ?? {}
const name = Object.keys(dependencies).find((item) =>
  item.endsWith(`-${platform}-${arch}`),
)
if (!name) {
  throw new Error(
    `${manifest.name} does not provide a binary for ${platform}-${arch}. Install with: curl -fsSL https://polar.sh/install.sh | bash`,
  )
}

function copyBinary(source) {
  if (!fs.existsSync(source)) throw new Error(`Binary not found at ${source}`)
  fs.mkdirSync(path.dirname(targetBinary), { recursive: true })
  fs.rmSync(targetBinary, { force: true })
  try {
    fs.linkSync(source, targetBinary)
  } catch {
    fs.copyFileSync(source, targetBinary)
  }
  fs.chmodSync(targetBinary, 0o755)
}

function resolveBinary() {
  const packagePath = require.resolve(`${name}/package.json`)
  return path.join(path.dirname(packagePath), 'bin', sourceBinary)
}

// Package managers skip optional dependencies when the lockfile was generated on
// another platform; fetch the exact platform package into a temporary prefix instead.
// npm is a .cmd wrapper on Windows, so it has to go through the shell there. The
// arguments stay static and the prefix is passed as cwd, so nothing needs quoting.
function installPackage() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polar-cli-install-'))
  // A global install passes its flag down to lifecycle scripts as npm_config_global
  // or npm_config_location, which would send the child install to the global prefix.
  const env = { ...process.env }
  delete env.npm_config_global
  delete env.npm_config_location
  try {
    fs.writeFileSync(path.join(temp, 'package.json'), '{}')
    const result = childProcess.spawnSync(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-save',
        '--loglevel=error',
        `${name}@${dependencies[name]}`,
      ],
      {
        cwd: temp,
        env,
        shell: process.platform === 'win32',
        stdio: 'inherit',
        windowsHide: true,
      },
    )
    if (result.status !== 0) return false
    copyBinary(path.join(temp, 'node_modules', name, 'bin', sourceBinary))
    return true
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

function verifyBinary() {
  return (
    childProcess.spawnSync(targetBinary, ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, POLAR_CLI_TELEMETRY_OPTOUT: '1' },
    }).status === 0
  )
}

function linkInstalledPackage() {
  try {
    copyBinary(resolveBinary())
    return verifyBinary()
  } catch {
    return false
  }
}

function main() {
  if (linkInstalledPackage()) return
  if (installPackage() && verifyBinary()) return
  throw new Error(
    `Failed to install ${manifest.name}. Try manually installing ${JSON.stringify(name)}, or install with: curl -fsSL https://polar.sh/install.sh | bash`,
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
