/**
 * Matches the lines of one step's file to the previous step's so unchanged
 * lines keep their key and the code panel can animate the edit instead of
 * repainting. A longest common subsequence over exact line text; ties go to
 * the earlier line so duplicates such as `})` stay in order.
 */
export const matchLines = (
  previous: readonly string[],
  next: readonly string[],
): ReadonlyArray<number | null> => {
  const rows = previous.length
  const cols = next.length
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  )
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      table[i]![j] =
        previous[i] === next[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }
  const matched = new Array<number | null>(cols).fill(null)
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (previous[i] === next[j]) {
      matched[j] = i
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i++
    } else {
      j++
    }
  }
  return matched
}

/** Keys for `next`, reusing `previousKeys` where a line carried over. */
export const keyLines = (
  previous: readonly string[],
  previousKeys: readonly string[],
  next: readonly string[],
  fresh: (index: number) => string,
): string[] =>
  matchLines(previous, next).map((from, index) =>
    from === null ? fresh(index) : previousKeys[from]!,
  )
