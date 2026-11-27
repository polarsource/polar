export const editDistance = (a: string, b: string) => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]!
}

export const closest = (wanted: string, candidates: ReadonlyArray<string>) => {
  const best = candidates
    .filter((candidate) => candidate !== wanted)
    .map((candidate) => ({
      candidate,
      distance: editDistance(wanted.toLowerCase(), candidate.toLowerCase()),
    }))
    .toSorted((a, b) => a.distance - b.distance)[0]
  return best && best.distance <= Math.max(1, Math.floor(wanted.length / 3))
    ? best.candidate
    : undefined
}
