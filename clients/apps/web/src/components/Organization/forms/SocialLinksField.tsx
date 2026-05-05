'use client'

import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { FormField } from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'

const SOCIAL_PLATFORM_DOMAINS: Record<string, string> = {
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
  'tiktok.com': 'tiktok',
  'discord.gg': 'discord',
  'discord.com': 'discord',
}

const getIcon = (platform: string, className: string) => {
  switch (platform) {
    case 'x':
      return <X className={className} />
    case 'instagram':
      return <Instagram className={className} />
    case 'facebook':
      return <Facebook className={className} />
    case 'github':
      return <GitHub className={className} />
    case 'youtube':
      return <YouTube className={className} />
    case 'linkedin':
      return <LinkedIn className={className} />
    default:
      return <Public className={className} />
  }
}

const inferPlatformFromUrl = (
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

const normalizeUrl = (value: string): string => {
  if (value.startsWith('http://')) {
    value = value.replace('http://', 'https://')
  }
  const hasProtocol = value.startsWith('https://')
  const isTypingProtocol =
    'https://'.startsWith(value) || 'http://'.startsWith(value)
  if (!hasProtocol && !isTypingProtocol) {
    value = 'https://' + value
  }
  return value
}

interface Props {
  required?: boolean
}

export const SocialLinksField = ({ required }: Props) => {
  const { control, formState } = useFormContext<schemas['OrganizationUpdate']>()

  const handleChange = (
    index: number,
    rawValue: string,
    socials: schemas['OrganizationSocialLink'][],
    updateField: (value: schemas['OrganizationSocialLink'][]) => void,
  ) => {
    const value = normalizeUrl(rawValue)
    const platform = inferPlatformFromUrl(value)
    const updatedSocials = [...socials]
    updatedSocials[index] = { platform, url: value }
    updateField(updatedSocials)
  }

  return (
    <FormField
      control={control}
      name="socials"
      render={({ field }) => {
        const socials = field.value || []
        const hasValidSocial = socials.some(
          (social) => social.url && social.url.trim() !== '',
        )
        const showError = required && formState.isSubmitted && !hasValidSocial

        return (
          <div className="space-y-3">
            {socials.map((social, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex w-5 justify-center">
                  {getIcon(social.platform, 'text-gray-400 h-4 w-4')}
                </div>
                <Input
                  type="url"
                  value={social.url || ''}
                  onChange={(e) =>
                    handleChange(index, e.target.value, socials, field.onChange)
                  }
                  placeholder="https://"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    field.onChange(socials.filter((_, i) => i !== index))
                  }}
                  className="dark:text-polar-400 text-gray-400 hover:text-gray-600"
                >
                  <CloseOutlined fontSize="small" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                field.onChange([...socials, { platform: 'other', url: '' }])
              }}
            >
              <AddOutlined fontSize="small" className="mr-1" />
              Add Social
            </Button>
            {showError && (
              <p className="text-destructive text-sm font-medium">
                At least one social media link is required
              </p>
            )}
          </div>
        )
      }}
    />
  )
}
