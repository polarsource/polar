import pc from 'picocolors'

const INDENT = '  '

export const dim = pc.dim
export const bold = pc.bold
export const cyan = pc.cyan
export const red = pc.red

export const command = (text: string) => pc.cyan(text)

export const failure = (title: string, hint?: string) => {
  const lines = [`${INDENT}${pc.red('✖')} ${pc.bold(title)}`]
  if (hint) {
    lines.push(`${INDENT}  ${pc.dim(hint)}`)
  }
  return lines.join('\n')
}
