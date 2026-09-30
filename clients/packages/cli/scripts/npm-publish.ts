#!/usr/bin/env bun
import { $ } from 'bun'
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import manifest from '../package.json' with { type: 'json' }
import {
  COMMAND,
  MAIN_PACKAGE,
  PLATFORM_PACKAGE_PREFIX,
  mainManifest,
  placeholderBinary,
  readme,
} from './npm-manifest.ts'

const packageRoot = path.resolve(import.meta.dirname, '..')
const dryRun = process.argv.includes('--dry-run')
const root = path.resolve(
  process.argv
    .find((item) => item.startsWith('--dist='))
    ?.slice('--dist='.length) ?? path.join(packageRoot, 'dist/npm'),
)

const published = async (name: string, version: string) =>
  (await $`npm view ${name}@${version} version`.quiet().nothrow()).exitCode ===
  0

const publish = async (directory: string, name: string, version: string) => {
  // Artifacts lose their mode bits between workflow jobs, so restore them before packing.
  if (process.platform !== 'win32') await $`chmod -R 755 .`.cwd(directory)
  if (dryRun) {
    await $`npm publish --dry-run --access public`.cwd(directory)
    return
  }
  if (await published(name, version)) {
    console.log(`already published ${name}@${version}`)
    return
  }
  await $`npm publish --access public`.cwd(directory)
}

const binaries: Record<string, string> = {}
const directories: Record<string, string> = {}
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('cli-')) continue
  const directory = path.join(root, entry.name)
  const item = (await Bun.file(
    path.join(directory, 'package.json'),
  ).json()) as {
    name: string
    version: string
  }
  if (!item.name.startsWith(PLATFORM_PACKAGE_PREFIX)) continue
  binaries[item.name] = item.version
  directories[item.name] = directory
}
console.log(`${MAIN_PACKAGE} binaries`, binaries)

const main = mainManifest(manifest.version, binaries)
const mainDirectory = path.join(root, 'cli')
await rm(mainDirectory, { recursive: true, force: true })
await mkdir(path.join(mainDirectory, 'bin'), { recursive: true })
await writeFile(
  path.join(mainDirectory, 'package.json'),
  `${JSON.stringify(main, null, 2)}\n`,
)
await writeFile(
  path.join(mainDirectory, 'bin', `${COMMAND}.exe`),
  placeholderBinary(),
)
await writeFile(path.join(mainDirectory, 'README.md'), readme(main.version))
await copyFile(
  path.join(packageRoot, 'scripts/npm-postinstall.mjs'),
  path.join(mainDirectory, 'postinstall.mjs'),
)
await copyFile(
  path.join(packageRoot, 'LICENSE'),
  path.join(mainDirectory, 'LICENSE'),
)

await Promise.all(
  Object.entries(binaries).map(([name, version]) =>
    publish(directories[name]!, name, version),
  ),
)
await publish(mainDirectory, main.name, main.version)
