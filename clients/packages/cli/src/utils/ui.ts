import pc from 'picocolors'
import type { SourceLocation } from '@/schemas/BillingConfig'

export const INDENT = '  '

let human = false
let sections = 0

export const setHuman = (value: boolean) => {
  human = value
  sections = 0
}

export const isHuman = () => human

export const dim = pc.dim
export const bold = pc.bold
export const cyan = pc.cyan
export const green = pc.green
export const yellow = pc.yellow
export const red = pc.red

export const command = (text: string) => pc.cyan(text)

export const check = () => pc.green(human ? '●' : '✔')

export const cross = () => pc.red(human ? '✕' : '✖')

export const success = (message: string) => `${INDENT}${check()} ${message}`

export const failure = (title: string, hint?: string) => {
  const lines = [`${INDENT}${cross()} ${pc.bold(pc.red(title))}`]
  if (hint) {
    lines.push(`${INDENT}  ${pc.dim(hint)}`)
  }
  return lines.join('\n')
}

export const warning = (message: string) =>
  `${INDENT}${pc.yellow('▲')} ${message}`

export const step = (message: string) => `${INDENT}${pc.dim(message)}`

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

const BOX_WIDTH = 120
const ESCAPE = '\x1b'
const ANSI = new RegExp(`(${ESCAPE}\\[[0-9;]*m)`)
const CLOSES: Record<string, (code: number) => boolean> = {
  '0': () => true,
  '22': (code) => code === 1 || code === 2,
  '23': (code) => code === 3,
  '24': (code) => code === 4,
  '27': (code) => code === 7,
  '28': (code) => code === 8,
  '29': (code) => code === 9,
  '39': (code) => (code >= 30 && code <= 37) || (code >= 90 && code <= 97),
  '49': (code) => (code >= 40 && code <= 47) || (code >= 100 && code <= 107),
}

const GRAPHEMES = new Intl.Segmenter()

export const inset = `${INDENT} ${INDENT}`

export const heading = (title: string) => `${INDENT}${pc.bold(title)}`

const BOX_MINIMUM = 20

export const boxInner = () =>
  Math.max(Math.min(process.stdout.columns || 80, BOX_WIDTH) - 4, BOX_MINIMUM)

const wrap = (line: string, width: number) => {
  const hanging = `${line.match(/^\s*/)?.[0] ?? ''}${INDENT}`
  const rows: string[] = []
  const active: string[] = []
  let row = ''
  let used = 0
  let limit = width
  let space: { index: number; used: number } | undefined
  const carry = (kept: string) => {
    row = `${hanging}${active.join('')}${kept}`
    used = Bun.stringWidth(hanging) + Bun.stringWidth(kept)
    limit = width
    space = undefined
  }
  for (const token of line.split(ANSI)) {
    if (ANSI.test(token)) {
      const closes = CLOSES[token.slice(2, -1)]
      if (closes) {
        for (let index = active.length - 1; index >= 0; index -= 1) {
          if (closes(Number(active[index]?.slice(2, -1)))) {
            active.splice(index, 1)
          }
        }
      } else {
        active.push(token)
      }
      row += token
      continue
    }
    for (const { segment: character } of GRAPHEMES.segment(token)) {
      const size = Bun.stringWidth(character)
      if (used + size > limit) {
        if (space) {
          rows.push(row.slice(0, space.index))
          carry(row.slice(space.index + 1))
        } else {
          rows.push(row)
          carry('')
        }
      }
      if (character === ' ' && used > Bun.stringWidth(hanging)) {
        space = { index: row.length, used }
      }
      row += character
      used += size
    }
  }
  rows.push(row)
  return rows
}

const boxTop = () => `${INDENT}${pc.dim(`╭${'─'.repeat(boxInner())}╮`)}`

export const boxBottom = () =>
  `${INDENT}${pc.dim(`╰${'─'.repeat(boxInner())}╯`)}`

const boxRows = (line: string) => {
  const inner = boxInner()
  return wrap(line, inner).map(
    (row) =>
      `${INDENT}${pc.dim('│')}${row}${' '.repeat(Math.max(inner - Bun.stringWidth(row), 0))}${pc.dim('│')}`,
  )
}

export const box = (text: string) =>
  [boxTop(), ...text.split('\n').flatMap(boxRows), boxBottom()].join('\n')

const sectionTitle = (title: string) => {
  if (!human) return heading(title)
  sections += 1
  return `${INDENT}${pc.dim(String(sections).padStart(2, '0'))}${INDENT}${pc.bold(title)}`
}

export const sectionOpen = (title: string) => [
  blank,
  sectionTitle(title),
  ...(human ? [] : [boxTop()]),
]

export const sectionRows = (line: string) =>
  human
    ? wrap(line, boxInner()).map((row) => `${INDENT}${INDENT}${row}`.trimEnd())
    : boxRows(line)

export const sectionClose = () => (human ? [] : [boxBottom()])

export const section = (title: string, text: string) =>
  human
    ? [...sectionOpen(title), ...text.split('\n').flatMap(sectionRows)]
    : [blank, heading(title), box(text)]

const LEADER = 26
const SEGMENT = 4

export const LEADER_PERIOD = LEADER + SEGMENT

const trail = (width: number, guide: string, period: number, tick?: number) => {
  if (tick === undefined) return pc.dim(guide.repeat(width))
  const start = (tick % period) - SEGMENT
  return Array.from({ length: width }, (_, index) =>
    index >= start && index < start + SEGMENT ? pc.bold(guide) : pc.dim(guide),
  ).join('')
}

export const leader = (label: string, tick?: number) =>
  `${label} ${trail(Math.max(LEADER - Bun.stringWidth(label), 3), '·', LEADER_PERIOD, tick)} `

export const track = (width: number, tick?: number) =>
  trail(width, '─', width + SEGMENT, tick)

export const trackFull = (width: number) => '─'.repeat(width)

export const truncate = (text: string, width: number) => {
  if (width <= 0) return ''
  if (Bun.stringWidth(text) <= width) return text
  let result = ''
  let used = 0
  let styled = false
  cut: for (const token of text.split(ANSI)) {
    if (ANSI.test(token)) {
      result += token
      styled = true
      continue
    }
    for (const { segment } of GRAPHEMES.segment(token)) {
      const size = Bun.stringWidth(segment)
      if (used + size > width - 1) break cut
      result += segment
      used += size
    }
  }
  return `${result}…${styled ? `${ESCAPE}[0m` : ''}`
}

export const pad = (text: string, width: number) =>
  text + ' '.repeat(Math.max(width - Bun.stringWidth(text), 0))

const CARD_GAP = 2
const CARD_MINIMUM = 24
const CARD_MAXIMUM = 34

const cardSpace = () =>
  (process.stdout.columns || 80) - INDENT.length + CARD_GAP

const cardsPerRow = (count: number) =>
  Math.max(
    Math.min(count, Math.floor(cardSpace() / (CARD_MINIMUM + CARD_GAP))),
    1,
  )

export const cardInner = (count: number) =>
  Math.max(
    Math.min(
      Math.floor(cardSpace() / cardsPerRow(count)) - CARD_GAP,
      CARD_MAXIMUM,
    ),
    CARD_MINIMUM,
  ) - 4

const card = (rows: ReadonlyArray<string>, inner: number) => [
  pc.dim(`┌─${' '.repeat(inner)}─┐`),
  ...rows.map((row) => `${INDENT}${pad(truncate(row, inner), inner)}${INDENT}`),
  pc.dim(`└─${' '.repeat(inner)}─┘`),
]

export const cardGrid = (cards: ReadonlyArray<ReadonlyArray<string>>) => {
  const perRow = cardsPerRow(cards.length)
  const framed = cards.map((rows) => card(rows, cardInner(cards.length)))
  return Array.from({ length: Math.ceil(framed.length / perRow) }, (_, row) =>
    framed.slice(row * perRow, (row + 1) * perRow),
  )
    .flatMap((group) =>
      (group[0] ?? []).map(
        (_, line) =>
          `${INDENT}${group.map((rows) => rows[line]).join(' '.repeat(CARD_GAP))}`,
      ),
    )
    .join('\n')
}

export const hideCursor = '\x1b[?25l'
export const showCursor = '\x1b[?25h'

export const repaint = (lines: ReadonlyArray<string>, previous: number) =>
  `${previous > 0 ? `\x1b[${previous}A` : ''}${lines.map((line) => `\r${line}\x1b[K\n`).join('')}`

export const inverse = pc.inverse

const clearLine = '\r\x1b[2K'
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

interface CodeFrameOptions {
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
