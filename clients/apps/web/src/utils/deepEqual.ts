// Copy of fast-deep-equal
// Handles key ordering, undefined, nested objects, arrays, NaN, and
// custom valueOf/toString — without adding an external dependency.

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor) return false
    if (Array.isArray(a)) {
      if (a.length !== (b as unknown[]).length) return false
      for (let i = a.length; i-- !== 0; )
        if (!deepEqual(a[i], (b as unknown[])[i])) return false
      return true
    }
    if (a.constructor === RegExp)
      return (
        (a as RegExp).source === (b as RegExp).source &&
        (a as RegExp).flags === (b as RegExp).flags
      )
    if (a.valueOf !== Object.prototype.valueOf)
      return a.valueOf() === b.valueOf()
    if (a.toString !== Object.prototype.toString)
      return a.toString() === b.toString()
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (let i = keys.length; i-- !== 0; )
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false
    for (let i = keys.length; i-- !== 0; )
      if (
        !deepEqual(
          (a as Record<string, unknown>)[keys[i]],
          (b as Record<string, unknown>)[keys[i]],
        )
      )
        return false
    return true
  }
  return a !== a && b !== b
}
