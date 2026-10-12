import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { Console, Context, Effect, Stdio } from 'effect'
import * as ui from '@/utils/ui'

const token =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

type Paint = (text: string) => string

const palette: Record<'key' | 'string' | 'number' | 'boolean' | 'null', Paint> =
  {
    key: ui.cyan,
    string: ui.green,
    number: ui.yellow,
    boolean: ui.yellow,
    null: ui.dim,
  }

export const highlight = (json: string, paint = palette) =>
  json.replace(token, (match, text?: string, colon?: string) => {
    if (text !== undefined) {
      return colon ? `${paint.key(text)}${colon}` : paint.string(text)
    }
    if (match === 'null') return paint.null(match)
    return match === 'true' || match === 'false'
      ? paint.boolean(match)
      : paint.number(match)
  })

const RUNTIME =
  /^(?:node|nodejs|bun|deno|python\d*(?:\.\d+)*|ruby|perl|php|java|uv|make|cargo|go)$/

type Env = Readonly<Record<string, string | undefined>>

export const Environment = Context.Reference<Env>('polar/Json/Environment', {
  defaultValue: () => ({}),
})

const commandName = (name: string) =>
  (name.split('/').pop() ?? name).toLowerCase()

const forced = (value: string | undefined) =>
  value !== undefined && value !== '' && value !== '0'

const runtimeAncestor = (ancestors: ReadonlyArray<string>) =>
  ancestors.some((name) => RUNTIME.test(commandName(name)))

export const colorJson = (input: {
  readonly terminal: boolean
  readonly stdinIsTerminal: boolean
  readonly env: Env
  readonly ancestors: () => ReadonlyArray<string>
}) => {
  if (!input.terminal) return false
  if (input.env['NO_COLOR']) return false
  if (input.env['FORCE_COLOR'] === '0') return false
  if (input.env['TERM'] === 'dumb' && !forced(input.env['FORCE_COLOR'])) {
    return false
  }
  if (forced(input.env['FORCE_COLOR'])) return true
  if (input.env['CI'] || !input.stdinIsTerminal) return false
  const ancestors = input.ancestors()
  return ancestors.length > 0 && !runtimeAncestor(ancestors)
}

const linuxAncestors = () => {
  const names: string[] = []
  let pid = process.ppid
  for (let depth = 0; depth < 6 && pid > 1; depth++) {
    let text: string
    try {
      text = readFileSync(`/proc/${pid}/status`, 'utf8')
    } catch {
      break
    }
    const name = /^Name:\t(.+)$/m.exec(text)?.[1]
    const ppid = /^PPid:\t(\d+)$/m.exec(text)?.[1]
    if (!name || !ppid) break
    names.push(name)
    pid = Number(ppid)
  }
  return names
}

const darwinAncestors = () => {
  const names: string[] = []
  let pid = process.ppid
  for (let depth = 0; depth < 6 && pid > 1; depth++) {
    let line: string
    try {
      line = execFileSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], {
        encoding: 'utf8',
        timeout: 500,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      break
    }
    const match = /^\s*(\d+)\s+(\S+)/.exec(line)
    const ppid = match?.[1]
    const name = match?.[2]
    if (!ppid || !name) break
    names.push(name)
    pid = Number(ppid)
  }
  return names
}

const ancestors = () => {
  if (process.platform === 'linux') return linuxAncestors()
  if (process.platform === 'darwin') return darwinAncestors()
  return []
}

export const printJson = (value: unknown) =>
  Effect.gen(function* () {
    const json = JSON.stringify(value, null, 2)
    const stdio = yield* Stdio.Stdio
    const color = colorJson({
      terminal: yield* stdio.stdoutIsTerminal,
      stdinIsTerminal: yield* stdio.stdinIsTerminal,
      env: yield* Environment,
      ancestors,
    })
    yield* Console.log(color ? highlight(json) : json)
  })
