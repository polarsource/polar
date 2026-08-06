import { useURLValidation } from '@/hooks/useURLValidation'
import { Grid, Input, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { SettingsGroupItem } from './SettingsGroup'

const URL_PLACEHOLDER = 'https://example.com/billing?email={EMAIL}'

const PLACEHOLDERS = [
  { name: '{EMAIL}', description: "The recipient's email address" },
  {
    name: '{EXTERNAL_ID}',
    description: 'Your own ID for the customer, empty when unset',
  },
  {
    name: '{ORDER_ID}',
    description: 'The order the link relates to, empty when not applicable',
  },
  {
    name: '{SUBSCRIPTION_ID}',
    description:
      'The subscription the link relates to, empty when not applicable',
  },
] as const

const withoutPlaceholders = (url: string) =>
  PLACEHOLDERS.reduce((acc, { name }) => acc.replaceAll(name, ''), url)

interface CustomerPortalUrlSettingProps {
  organizationId: string
  value: string | null
  readOnly: boolean
  onChange: (portalUrl: string | null) => void
}

export default function CustomerPortalUrlSetting({
  organizationId,
  value,
  readOnly,
  onChange,
}: CustomerPortalUrlSettingProps) {
  const [enabled, setEnabled] = useState(() => !!value)
  const [url, setUrl] = useState(value ?? '')
  const {
    status: urlStatus,
    validateURL,
    reset: resetValidation,
  } = useURLValidation({ organizationId })

  return (
    <Box flexDirection="column" width="100%">
      <SettingsGroupItem
        title="Customer portal URL override"
        description="Point customer portal links in emails to your own billing page instead of the Polar customer portal."
      >
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked)
            if (!checked) {
              setUrl('')
              resetValidation()
              if (value) {
                onChange(null)
              }
              return
            }
            if (url.trim()) {
              void validateURL(withoutPlaceholders(url.trim()))
            }
          }}
          disabled={readOnly}
        />
      </SettingsGroupItem>
      <div
        aria-hidden={!enabled}
        className="grid transition-[grid-template-rows] duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: enabled ? '1fr' : '0fr' }}
      >
        <Box overflow="hidden" display="block" width="100%">
          <div
            className={`transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:translate-y-0 motion-reduce:transition-none ${
              enabled ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            <Box
              flexDirection="column"
              rowGap="m"
              paddingHorizontal="l"
              paddingBottom="l"
              width="100%"
            >
              <Box flexDirection="column" rowGap="xs" width="100%">
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    if (urlStatus !== 'idle') {
                      resetValidation()
                    }
                  }}
                  onBlur={() => {
                    const trimmed = url.trim()
                    const portalUrl = trimmed === '' ? null : trimmed
                    if (portalUrl !== value) {
                      onChange(portalUrl)
                    }
                    void validateURL(withoutPlaceholders(trimmed))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                  type="url"
                  placeholder={URL_PLACEHOLDER}
                  disabled={readOnly}
                  tabIndex={enabled ? undefined : -1}
                  aria-label="Destination URL"
                  postSlot={
                    urlStatus === 'validating' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : urlStatus === 'valid' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : urlStatus === 'invalid' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : null
                  }
                />
                {urlStatus === 'invalid' && (
                  <Text variant="caption" color="warning">
                    URL appears to be unreachable
                  </Text>
                )}
              </Box>

              <Box
                flexDirection="column"
                width="100%"
                borderRadius="m"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Box flexDirection="column" rowGap="s" padding="m" width="100%">
                  <Text variant="caption" color="muted">
                    Placeholders are filled in when each link is generated
                  </Text>
                  <Grid
                    templateColumns="auto 1fr"
                    columnGap="l"
                    rowGap="s"
                    width="100%"
                  >
                    {PLACEHOLDERS.map(({ name, description }) => (
                      <React.Fragment key={name}>
                        <Text as="span" variant="caption" monospace>
                          {name}
                        </Text>
                        <Text as="span" variant="caption" color="muted">
                          {description}
                        </Text>
                      </React.Fragment>
                    ))}
                  </Grid>
                </Box>

                <Box
                  width="100%"
                  borderTopWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                />

                <Box padding="m" width="100%">
                  <Text variant="caption" color="muted">
                    Used in purchase and subscription confirmations, renewals,
                    plan changes, cancellations, payment failures, and
                    reminders. Sign-in code and seat invitation emails still
                    link to Polar.
                  </Text>
                </Box>
              </Box>
            </Box>
          </div>
        </Box>
      </div>
    </Box>
  )
}
