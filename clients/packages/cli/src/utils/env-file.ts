const assignment = (key: string) =>
  new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`)

export const upsertEnv = (content: string, key: string, value: string) => {
  const line = `${key}=${value}`
  const lines = content.split('\n')
  const pattern = assignment(key)
  const index = lines.findIndex((existing) => pattern.test(existing))
  if (index !== -1) {
    lines[index] = line
    return { content: lines.join('\n'), replaced: true }
  }
  const separator = content === '' || content.endsWith('\n') ? '' : '\n'
  return { content: `${content}${separator}${line}\n`, replaced: false }
}

export const hasEnv = (content: string, key: string) => {
  const pattern = assignment(key)
  return content.split('\n').some((line) => pattern.test(line))
}
