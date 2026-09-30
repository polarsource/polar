const isLongFlagWithoutValue = (arg: string) => /^--[^=]+$/.test(arg)

const isDashValue = (arg: string) =>
  /^-[^-]/.test(arg) && !/^-[a-z](=|$)/i.test(arg)

export const joinDashValues = (args: ReadonlyArray<string>): string[] => {
  const separator = args.indexOf('--')
  const end = separator === -1 ? args.length : separator
  const joined: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    const next = args[index + 1]
    if (
      index + 1 < end &&
      next !== undefined &&
      isLongFlagWithoutValue(arg) &&
      isDashValue(next)
    ) {
      joined.push(`${arg}=${next}`)
      index++
    } else {
      joined.push(arg)
    }
  }
  return joined
}
