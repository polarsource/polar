export const serializeMCPSessionCookie = (
  organizationId: string,
  token: string,
): string => JSON.stringify({ organizationId, token })

export const parseMCPSessionCookie = (
  value: string,
  organizationId: string,
): string | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'organizationId' in parsed &&
      parsed.organizationId === organizationId &&
      'token' in parsed &&
      typeof parsed.token === 'string'
    ) {
      return parsed.token
    }
  } catch {
    // Legacy cookie values stored the bare token without organization scoping;
    // treat them as a miss so a properly scoped token is minted.
  }
  return null
}
