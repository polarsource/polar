import { useURLValidation } from '@/hooks/useURLValidation'
import { Grid, Input, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { SettingsGroupItem } from './SettingsGroup'

const URL_PLACEHOLDER = 'https://example.com/purchases'

const APPENDED_PARAMS = [
  { name: 'email', description: "The customer's email address" },
  {
    name: 'external_id',
    description: 'Your own ID for the customer, when set',
  },
] as const

interface CustomerEmailLinkSettingProps {
  organizationId: string
  value: string | null
  readOnly: boolean
  onChange: (linkUrl: string | null) => void
}

export default function CustomerEmailLinkSetting({
  organizationId,
  value,
  readOnly,
  onChange,
}: CustomerEmailLinkSettingProps) {
  const [enabled, setEnabled] = useState(() => !!value)
  const [url, setUrl] = useState(value ?? '')
  const {
    status: urlStatus,
    validateURL,
    reset: resetValidation,
  } = useURLValidation({ organizationId })

  useEffect(() => {
    if (enabled && value) {
      void validateURL(value)
    }
  }, [enabled, value, validateURL])

  const handleOnBlur = () => {
    const trimmed = url.trim()
    const linkUrl = trimmed === '' ? null : trimmed
    if (linkUrl !== value) {
      onChange(linkUrl)
    }
    void validateURL(trimmed)
  }

  const previewBase = url.trim() || URL_PLACEHOLDER

  return (
    <Box flexDirection="column" width="100%">
      <SettingsGroupItem
        title="Custom purchase link"
        description="Point the Access purchase button in order and subscription confirmation emails to your own site. Billing emails always link to Polar's customer portal."
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
                  onBlur={handleOnBlur}
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
                backgroundColor="background-secondary"
              >
                <Box
                  flexDirection="column"
                  rowGap="xs"
                  padding="m"
                  width="100%"
                >
                  <Text variant="caption" color="muted">
                    Email links will point to
                  </Text>
                  <div className="wrap-anywhere">
                    <Text variant="caption" monospace color="muted">
                      {previewBase}
                      {APPENDED_PARAMS.map(({ name }, index) => (
                        <React.Fragment key={name}>
                          <wbr />
                          <Text
                            as="span"
                            variant="caption"
                            monospace
                            wrap="nowrap"
                            color="muted"
                          >
                            {index === 0 ? '?' : '&'}
                            <Text as="span" variant="caption" monospace>
                              {name}
                            </Text>
                            {`=<${name}>`}
                          </Text>
                        </React.Fragment>
                      ))}
                    </Text>
                  </div>
                </Box>

                <Box
                  width="100%"
                  borderTopWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                />

                <Grid
                  templateColumns="auto 1fr"
                  columnGap="l"
                  rowGap="s"
                  padding="m"
                  width="100%"
                >
                  {APPENDED_PARAMS.map(({ name, description }) => (
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
            </Box>
          </div>
        </Box>
      </div>
    </Box>
  )
}
