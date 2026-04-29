import { writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { ElementReport } from './types.ts'

export function writeReport(
  reports: ElementReport[],
  outPath: string,
  cwd: string,
): void {
  const byFile = new Map<string, ElementReport[]>()
  for (const r of reports) {
    const list = byFile.get(r.file) ?? []
    list.push(r)
    byFile.set(r.file, list)
  }

  const totals = {
    converted: reports.filter((r) => r.status === 'converted').length,
    partial: reports.filter((r) => r.status === 'partial').length,
    skipped: reports.filter((r) => r.status === 'skipped').length,
  }

  const lines: string[] = []
  lines.push('# Box codemod report')
  lines.push('')
  lines.push(
    `Converted: ${totals.converted} | Partial: ${totals.partial} | Skipped: ${totals.skipped}`,
  )
  lines.push('')

  const sortedFiles = [...byFile.keys()].sort()
  for (const file of sortedFiles) {
    const rel = relative(cwd, file)
    lines.push(`## ${rel}`)
    lines.push('')
    for (const r of byFile.get(file) ?? []) {
      const tag =
        r.status === 'converted'
          ? 'CONVERTED'
          : r.status === 'partial'
            ? 'PARTIAL'
            : 'SKIPPED'
      const parts: string[] = [`L${r.line} ${tag}`]
      if (r.reason) parts.push(`reason: ${r.reason}`)
      if (r.leftover && r.leftover.length > 0) {
        parts.push(`leftover className: "${r.leftover.join(' ')}"`)
      }
      if (r.ambiguous && r.ambiguous.length > 0) {
        parts.push(`ambiguous: ${r.ambiguous.join('; ')}`)
      }
      lines.push(`- ${parts.join(' — ')}`)
    }
    lines.push('')
  }

  writeFileSync(outPath, lines.join('\n'), 'utf8')
}

export function summarizeToConsole(reports: ElementReport[]): void {
  const converted = reports.filter((r) => r.status === 'converted').length
  const partial = reports.filter((r) => r.status === 'partial').length
  const skipped = reports.filter((r) => r.status === 'skipped').length
  // eslint-disable-next-line no-console
  console.log(
    `Box codemod: ${converted} converted, ${partial} partial, ${skipped} skipped`,
  )
}
