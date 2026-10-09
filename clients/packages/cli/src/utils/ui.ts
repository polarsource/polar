import pc from 'picocolors'
import type { SourceLocation } from '@/schemas/BillingConfig'

export const INDENT = '  '

export const dim = pc.dim
export const bold = pc.bold
export const cyan = pc.cyan
export const green = pc.green
export const yellow = pc.yellow
export const red = pc.red

export const command = (text: string) => pc.cyan(text)

export const commands = (text: string) =>
  text.replace(/`([^`]+)`/g, (_, inner: string) => command(inner))

export const success = (message: string) =>
  `${INDENT}${pc.green('✔')} ${commands(message)}`

export const failure = (title: string, hint?: string) => {
  const lines = [`${INDENT}${pc.red('✖')} ${pc.bold(pc.red(commands(title)))}`]
  if (hint) {
    lines.push(`${INDENT}  ${pc.dim(commands(hint))}`)
  }
  return lines.join('\n')
}

export const warning = (message: string) =>
  `${INDENT}${pc.yellow('▲')} ${commands(message)}`

export const step = (message: string) => `${INDENT}${pc.dim(commands(message))}`

export const keyValue = (rows: ReadonlyArray<readonly [string, string]>) => {
  const width = Math.max(...rows.map(([label]) => Bun.stringWidth(label)))
  return rows
    .map(
      ([label, value]) =>
        `${INDENT}${pc.dim(label + ' '.repeat(width - Bun.stringWidth(label)))}  ${value}`,
    )
    .join('\n')
}

export const blank = ''
export const clearLine = '\r\x1b[2K'
export const clearLines = (rows: number) =>
  rows > 0 ? clearLine + `\x1b[1A${clearLine}`.repeat(rows - 1) : ''

export const statusCode = (status: number, statusText: string) => {
  const text = `${status} ${statusText}`.trim()
  if (status >= 500) return pc.red(text)
  if (status >= 300) return pc.yellow(text)
  return pc.green(text)
}

export const timestamp = (date: Date = new Date()) =>
  pc.dim(date.toTimeString().slice(0, 8))

export const duration = (milliseconds: number) =>
  pc.dim(`${Math.round(milliseconds)}ms`)

export const updateNotice = (current: string, latest: string) =>
  [
    blank,
    warning(
      `Update available ${pc.dim(current)} ${pc.dim('→')} ${pc.bold(pc.cyan(latest))}`,
    ),
    step(`Run ${command('polar update')} to install it`),
    blank,
    blank,
  ].join('\n')

const isPrintable = (character: string) =>
  !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(character)

export const printable = (text: string) =>
  [...text]
    .filter(
      (character) =>
        character === '\n' || character === '\t' || isPrintable(character),
    )
    .join('')

export const pushTitle = (title: string) =>
  `\x1b[22;0t\x1b]0;${[...title].filter(isPrintable).join('')}\x07`

export const popTitle = '\x1b]0;\x07\x1b[23;0t'

export interface CodeFrameOptions {
  readonly file: string
  readonly location: SourceLocation
  readonly label: string
  readonly color?: (text: string) => string
}

const expandTabs = (text: string) => text.replaceAll('\t', '  ')

export const codeFrame = (source: string, options: CodeFrameOptions) => {
  const { file, location, label, color = pc.red } = options
  const lines = printable(source).split('\n')
  const first = Math.max(location.line - 1, 1)
  const last = Math.min(location.line + 1, lines.length)
  const gutterWidth = String(last).length
  const blank = ' '.repeat(gutterWidth)
  const row = (number: number) =>
    `${pc.dim(`${String(number).padStart(gutterWidth)} │`)} ${expandTabs(lines[number - 1] ?? '')}`
  const length = Math.max(location.length, 1)
  const middle = Math.floor((length - 1) / 2)
  const underline = `${'─'.repeat(middle)}┬${'─'.repeat(length - middle - 1)}`
  const target = lines[location.line - 1] ?? ''
  const offset = ' '.repeat(
    expandTabs(target.slice(0, Math.max(location.column - 1, 0))).length,
  )
  const frame = [
    `${blank} ${pc.dim(`╭─[${file}:${location.line}:${location.column}]`)}`,
    ...Array.from({ length: location.line - first }, (_, index) =>
      row(first + index),
    ),
    row(location.line),
    `${blank} ${pc.dim('·')} ${offset}${color(underline)}`,
    `${blank} ${pc.dim('·')} ${offset}${' '.repeat(middle)}${color('╰──')} ${label}`,
    ...Array.from({ length: last - location.line }, (_, index) =>
      row(location.line + 1 + index),
    ),
    `${blank} ${pc.dim('╰────')}`,
  ]
  return frame.map((line) => `${INDENT}${line}`).join('\n')
}
