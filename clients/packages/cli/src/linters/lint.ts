import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BlockedError,
  type Observation,
  record,
  type Recording,
} from '@/linters/recorder'
import { RULES } from '@/linters/rules'
import type { ConfigIssue } from '@/schemas/BillingConfig'

export type ReadSource = (file: string) => string | undefined

const readSource: ReadSource = (file) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

interface Frame {
  readonly file: string
  readonly line: number
  readonly column: number
}

const FRAME = /\(?((?:\/|[A-Za-z]:\\|file:\/\/)[^():]+):(\d+):(\d+)\)?\s*$/

const OWN_SOURCE = fileURLToPath(new URL('..', import.meta.url))

const tooling = (file: string) =>
  file.startsWith(OWN_SOURCE) || file.includes('/node_modules/')

const frames = (stack: string): ReadonlyArray<Frame> =>
  stack.split('\n').flatMap((text) => {
    const match = FRAME.exec(text)
    if (!match) return []
    const file = match[1]!.replace(/^file:\/\//, '')
    return tooling(file)
      ? []
      : [{ file, line: Number(match[2]), column: Number(match[3]) }]
  })

const origin = (stack: string): Frame | undefined => frames(stack)[0]

const suppressed = (lines: ReadonlyArray<string>, line: number) =>
  (lines[line - 1]?.includes('polar-disable-line') ?? false) ||
  (lines[line - 2]?.includes('polar-disable-next-line') ?? false)

const position = (text: string, root: string, column: number) => {
  const name = root.replace(/\(\)$/, '')
  const at = text.indexOf(name, Math.max(0, column - name.length - 1))
  return at === -1
    ? { column, length: 1 }
    : { column: at + 1, length: name.length }
}

export const issuesFrom = (
  entry: string,
  observations: ReadonlyArray<Observation>,
  read: ReadSource = readSource,
): ReadonlyArray<ConfigIssue> => {
  const entryFile = resolve(entry)
  const sources = new Map<string, ReadonlyArray<string>>()
  const linesOf = (file: string) => {
    const cached = sources.get(file)
    if (cached) return cached
    const lines = (read(file) ?? '').split('\n')
    sources.set(file, lines)
    return lines
  }
  const seen = new Set<string>()
  return observations.flatMap(({ rule, root, stack }) => {
    const frame = origin(stack)
    if (frame === undefined) return []
    const key = `${rule}:${frame.file}:${frame.line}`
    if (seen.has(key)) return []
    seen.add(key)
    const lines = linesOf(frame.file)
    if (suppressed(lines, frame.line)) return []
    const { severity, message } = RULES[rule]
    if (frame.file !== entryFile) {
      return [
        {
          severity,
          code: rule,
          path: `${relative(dirname(entryFile), frame.file)}:${frame.line}`,
          message,
        },
      ]
    }
    return [
      {
        severity,
        code: rule,
        path: root.replace(/\(\)$/, ''),
        message,
        location: {
          line: frame.line,
          ...position(lines[frame.line - 1] ?? '', root, frame.column),
        },
      },
    ]
  })
}

export interface Checked<T> {
  readonly value: T | undefined
  readonly failure: unknown
  readonly issues: ReadonlyArray<ConfigIssue>
}

export const evaluateChecked = async <T>(
  entry: string,
  run: () => Promise<T>,
): Promise<Checked<T>> => {
  const recording: Recording<T> = await record(run)
  const issues = issuesFrom(entry, recording.observations)
  const blocked =
    recording.failure instanceof BlockedError &&
    issues.some((issue) => issue.severity === 'error')
  return {
    value: recording.value,
    failure: blocked ? undefined : recording.failure,
    issues,
  }
}
