'use client'

import { Button, Switch, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  APPLY_LABEL,
  TAX_SETTING_HINTS,
  TAX_SETTING_MIXED,
} from './taxSettingCopy'
import { initialChoice, TaxOptionProps } from './useTaxSetting'

export function TaxOptionToggle({
  current,
  canApply,
  onApply,
}: TaxOptionProps) {
  const [choice, setChoice] = useState(initialChoice(current))
  const onTop = choice === 'exclusive'

  return (
    <Box flexDirection="column" rowGap="m">
      <Box
        as="label"
        display="flex"
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        cursor="pointer"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text>Add tax on top of the price</Text>
          <Text variant="caption" color={onTop ? 'warning' : 'muted'}>
            {current === 'mixed' && !onTop
              ? TAX_SETTING_MIXED
              : TAX_SETTING_HINTS[choice]}
          </Text>
        </Box>
        <Switch
          checked={onTop}
          onCheckedChange={(checked) =>
            setChoice(checked ? 'exclusive' : 'inclusive')
          }
        />
      </Box>
      {canApply(choice) ? (
        <Box justifyContent="end">
          <Button size="sm" onClick={() => onApply(choice)}>
            {APPLY_LABEL}
          </Button>
        </Box>
      ) : null}
    </Box>
  )
}
