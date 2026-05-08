'use client'

import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
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
        const renderRows: schemas['OrganizationSocialLink'][] =
          socials.length === 0 ? [{ platform: 'other', url: '' }] : socials
        const hasValidSocial = socials.some(
          (social) => social.url && social.url.trim() !== '',
        )
        const showError = required && formState.isSubmitted && !hasValidSocial

        return (
          <div className="space-y-3">
            {renderRows.map((social, index) => {
              const url = social.url ?? ''
              const trimmed = url.trim()
              const hasUrl = trimmed !== '' && trimmed !== 'https://'
              const isOnlyRow = renderRows.length === 1
              const showRemove = hasUrl || !isOnlyRow

              return (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) =>
                      handleChange(
                        index,
                        e.target.value,
                        socials,
                        field.onChange,
                      )
                    }
                    placeholder="https://x.com/yourhandle"
                    className="flex-1"
                  />
                  {showRemove && (
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
                  )}
                </div>
              )
            })}
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
