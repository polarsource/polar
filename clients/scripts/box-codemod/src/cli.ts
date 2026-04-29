#!/usr/bin/env tsx
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { runTransform } from './transform.ts'
import { summarizeToConsole, writeReport } from './report.ts'
import type { ElementReport } from './types.ts'

interface Args {
  paths: string[]
  dryRun: boolean
  reportPath: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    paths: [],
    dryRun: false,
    reportPath: 'box-codemod-report.md',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-d') out.dryRun = true
    else if (a === '--report' || a === '-r') out.reportPath = argv[++i]
    else if (a.startsWith('--report='))
      out.reportPath = a.slice('--report='.length)
    else out.paths.push(a)
  }
  return out
}

// pnpm sets INIT_CWD to the directory the user invoked pnpm from.
// Using it here means relative paths resolve from where the user typed
// the command, not from the package dir that --filter cd'd into.
const USER_CWD = process.env.INIT_CWD || process.cwd()

async function expandPaths(paths: string[]): Promise<string[]> {
  const files: string[] = []
  for (const p of paths) {
    const abs = resolve(USER_CWD, p)
    const stat = statSync(abs)
    if (stat.isFile()) {
      if (abs.endsWith('.tsx') || abs.endsWith('.ts')) files.push(abs)
    } else if (stat.isDirectory()) {
      await walk(abs, files)
    }
  }
  return files
}

async function walk(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (
      e.name === 'node_modules' ||
      e.name === '.next' ||
      e.name.startsWith('.')
    )
      continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      await walk(full, out)
    } else if (e.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts'))) {
      out.push(full)
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.paths.length === 0) {
    console.error(
      'Usage: box-codemod <file-or-dir>... [--dry-run] [--report=path.md]',
    )
    process.exit(1)
  }

  const files = await expandPaths(args.paths)
  const allReports: ElementReport[] = []
  let modified = 0

  for (const file of files) {
    try {
      const source = readFileSync(file, 'utf8')
      const result = runTransform({ path: file, source })
      allReports.push(...result.reports)
      if (result.source && result.source !== source) {
        modified++
        if (!args.dryRun) writeFileSync(file, result.source, 'utf8')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      allReports.push({
        file,
        line: 0,
        status: 'skipped',
        reason: `transform crashed: ${msg}`,
      })
      console.error(`Error transforming ${file}: ${msg}`)
    }
  }

  const reportAbs = resolve(USER_CWD, args.reportPath)
  writeReport(allReports, reportAbs, USER_CWD)
  summarizeToConsole(allReports)
  console.log(
    `${modified} file(s) ${args.dryRun ? 'would be' : ''} modified. Report: ${reportAbs}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
