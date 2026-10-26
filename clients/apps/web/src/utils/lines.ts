/**
 * Pairs each line with its character offset in the joined text, which stays
 * unique across repeated lines and can key them.
 */
export const withOffsets = (lines: string[]) => {
  let offset = 0
  return lines.map((line) => {
    const entry = { line, offset }
    offset += line.length + 1
    return entry
  })
}
