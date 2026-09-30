import pc from 'picocolors'

const INDENT = '  '

export const dim = pc.dim
export const bold = pc.bold
export const cyan = pc.cyan
export const green = pc.green
export const yellow = pc.yellow
export const red = pc.red

export const command = (text: string) => pc.cyan(text)

export const success = (message: string) =>
  `${INDENT}${pc.green('✔')} ${message}`

export const failure = (title: string, hint?: string) => {
  const lines = [`${INDENT}${pc.red('✖')} ${pc.bold(pc.red(title))}`]
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
