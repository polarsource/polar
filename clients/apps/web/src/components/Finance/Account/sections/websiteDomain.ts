import { schemas } from '@polar-sh/client'

export const websiteHost = (website: string): string | null => {
  try {
    return new URL(website).hostname
  } catch {
    return null
  }
}

export const findWebsiteDomain = (
  host: string,
  domains: schemas['OrganizationDomain'][],
): schemas['OrganizationDomain'] | undefined => {
  const matching = domains.filter(
    (d) => host === d.domain || host.endsWith(`.${d.domain}`),
  )
  return matching.find((d) => d.verified_at) ?? matching[0]
}
