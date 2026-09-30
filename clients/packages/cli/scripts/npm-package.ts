#!/usr/bin/env bun
import { chmod, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import manifest from '../package.json' with { type: 'json' }
import {
  binaryName,
  findTarget,
  platformDirectory,
  platformManifest,
} from './npm-manifest.ts'

const argument = (name: string) =>
  process.argv
    .find((item) => item.startsWith(`--${name}=`))
    ?.slice(name.length + 3)

const target = findTarget(argument('target'))
const binary = binaryName(target.os)
const source = path.resolve(argument('binary') ?? binary)
const outdir = path.resolve(argument('outdir') ?? 'dist/npm')
const directory = path.join(outdir, platformDirectory(target))
const packageManifest = platformManifest(target, manifest.version)

await rm(directory, { recursive: true, force: true })
await mkdir(path.join(directory, 'bin'), { recursive: true })
await copyFile(source, path.join(directory, 'bin', binary))
await chmod(path.join(directory, 'bin', binary), 0o755)
await writeFile(
  path.join(directory, 'package.json'),
  `${JSON.stringify(packageManifest, null, 2)}\n`,
)

console.log(
  `packaged ${packageManifest.name}@${packageManifest.version} from ${source} into ${directory}`,
)
