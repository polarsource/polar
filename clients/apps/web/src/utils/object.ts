export function stripEmptyProperties<T extends object>(object: T): T
export function stripEmptyProperties<T extends object>(
  object: T | null | undefined,
): T | null | undefined
export function stripEmptyProperties(
  object: object | null | undefined,
): object | null | undefined {
  if (!object) {
    return object
  }
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}
