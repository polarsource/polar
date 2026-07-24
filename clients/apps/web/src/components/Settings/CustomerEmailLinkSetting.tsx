import { Grid, Input, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

const URL_PLACEHOLDER = 'https://example.com/purchases'

const APPENDED_PARAMS = [
  { name: 'email', description: "The customer's email address" },
  { name: 'external_id', description: 'Your own ID for the customer, when set' },
] as const

interface CustomerEmailLinkSettingProps {
  value: string | null
  readOnly: boolean
  onChange: (linkUrl: string | null) => void
}

const CustomerEmailLinkSetting: React.FC<CustomerEmailLinkSettingProps> = ({
  value,
  readOnly,
  onChange,
}) => {
  const [enabled, setEnabled] = React.useState(() => !!value)
  const [url, setUrl] = React.useState(value ?? '')

  React.useEffect(() => {
    setEnabled(!!value)
    setUrl(value ?? '')
  }, [value])

  const commit = () => {
    const trimmed = url.trim()
    const linkUrl = trimmed === '' ? null : trimmed
    if (linkUrl !== (value || null)) {
      onChange(linkUrl)
    }
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)
    if (!checked) {
      setUrl('')
      if (value) {
        onChange(null)
      }
    }
  }

  const previewBase = url.trim() || URL_PLACEHOLDER

  return (
    <SettingsGroup>
      <Box flexDirection="column" width="100%">
        <SettingsGroupItem
          title="Custom purchase link"
          description="Point the Access purchase button in order and subscription confirmation emails to your own site. Billing emails always link to Polar's customer portal."
        >
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
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
                enabled
                  ? 'translate-y-0 opacity-100'
                  : '-translate-y-1 opacity-0'
              }`}
            >
              <Box
                flexDirection="column"
                rowGap="m"
                paddingHorizontal="l"
                paddingBottom="l"
                width="100%"
              >
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={commit}
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
                />
  
                <Box
                  flexDirection="column"
                  width="100%"
                  borderRadius="m"
                  borderWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                  backgroundColor="background-secondary"
                >
                  <Box flexDirection="column" rowGap="xs" padding="m" width="100%">
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
    </SettingsGroup>
  )
}

export default CustomerEmailLinkSetting
