import { schemas } from '@polar-sh/client'

export const SOCIAL_PLATFORM_DOMAINS: Record<string, string> = {
  'x.com': 'x',
  'twitter.com': 'x',
  'instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'linkedin.com': 'linkedin',
  'github.com': 'github',
  'threads.net': 'threads',
  'threads.com': 'threads',
  'tiktok.com': 'tiktok',
  'discord.gg': 'discord',
  'discord.com': 'discord',
}

export const inferPlatformFromUrl = (
  url: string,
): schemas['OrganizationSocialPlatforms'] => {
  try {
    const parsed = new URL(url)
    let hostname = parsed.hostname
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4)
    }
    return (SOCIAL_PLATFORM_DOMAINS[hostname] ??
      'other') as schemas['OrganizationSocialPlatforms']
  } catch {
    return 'other'
  }
}
