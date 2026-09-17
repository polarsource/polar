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
  const width = Math.max(...rows.map(([label]) => label.length))
  return rows
    .map(
      ([label, value]) => `${INDENT}${pc.dim(label.padEnd(width))}  ${value}`,
    )
    .join('\n')
}

export const blank = ''

export const statusCode = (status: number, statusText: string) => {
  const text = `${status} ${statusText}`.trim()
  if (status >= 500) return pc.red(text)
  if (status >= 400) return pc.yellow(text)
  return pc.green(text)
}

export const timestamp = (date: Date = new Date()) =>
  pc.dim(date.toTimeString().slice(0, 8))

export const duration = (milliseconds: number) =>
  pc.dim(`${Math.round(milliseconds)}ms`)
