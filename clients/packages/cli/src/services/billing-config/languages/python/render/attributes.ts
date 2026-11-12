const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/

const KEYWORDS =
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  )

export const attributeNames = (
  externalIds: ReadonlyArray<string>,
  fallbackPrefix: string,
  helpers: ReadonlyArray<string>,
) => {
  const reserved = new Set([...KEYWORDS, ...helpers])
  const usable = (externalId: string) =>
    IDENTIFIER.test(externalId) && !reserved.has(externalId)
  const taken = new Set(externalIds.filter(usable))
  return externalIds.map((externalId) => {
    if (usable(externalId)) return externalId
    const base = externalId.replaceAll(/\W/g, '_').replace(/^_+/, '')
    const name =
      /^[A-Za-z]/.test(base) && !reserved.has(base)
        ? base
        : `${fallbackPrefix}_${base}`
    let attribute = name
    for (let count = 2; taken.has(attribute); count++) {
      attribute = `${name}_${count}`
    }
    taken.add(attribute)
    return attribute
  })
}
