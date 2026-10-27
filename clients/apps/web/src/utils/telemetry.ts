// Agent claim link tokens are live secrets carried in the claim page URL, in
// return_to (URL-encoded) and in the claim summary API path (ADR-0013). Their
// characters are URL-safe, so encoding never hides the prefix.
const CLAIM_LINK_TOKEN = /polar_acl_[A-Za-z0-9]+/g

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export const redactClaimTokens = <T>(
  value: T,
  ancestors = new WeakSet<object>(),
): T => {
  if (typeof value === 'string') {
    return value.replace(CLAIM_LINK_TOKEN, '{link_token}') as T
  }
  if (value instanceof URL) {
    return new URL(redactClaimTokens(value.href)) as T
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (ancestors.has(value)) {
    return '[Circular]' as T
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value
  }
  ancestors.add(value)
  const redacted = Array.isArray(value)
    ? value.map((item) => redactClaimTokens(item, ancestors))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          redactClaimTokens(item, ancestors),
        ]),
      )
  ancestors.delete(value)
  return redacted as T
}
