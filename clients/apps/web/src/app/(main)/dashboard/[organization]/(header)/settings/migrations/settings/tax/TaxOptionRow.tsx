'use client'

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { TaxBehavior } from '../../bulkTax/bulkTaxRecords'
import {
  APPLY_LABEL,
  TAX_SETTING_HINTS,
  TAX_SETTING_MIXED,
} from './taxSettingCopy'
import { initialChoice, TaxOptionProps } from './useTaxSetting'

const OPTIONS: Record<TaxBehavior, string> = {
  inclusive: 'Included in price',
  exclusive: 'Added on top',
}

export function TaxOptionRow({ current, canApply, onApply }: TaxOptionProps) {
  const [choice, setChoice] = useState(initialChoice(current))

  return (
    <Box flexDirection="column" rowGap="s">
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Text>Tax</Text>
        <Box alignItems="center" columnGap="s">
          <Box width={180}>
            <Select
              value={choice}
              onValueChange={(value) => setChoice(value as TaxBehavior)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive">{OPTIONS.inclusive}</SelectItem>
                <SelectItem value="exclusive">{OPTIONS.exclusive}</SelectItem>
              </SelectContent>
            </Select>
          </Box>
          {canApply(choice) ? (
            <Button size="sm" onClick={() => onApply(choice)}>
              {APPLY_LABEL}
            </Button>
          ) : null}
        </Box>
      </Box>
      <Text
        variant="caption"
        color={choice === 'exclusive' ? 'warning' : 'muted'}
      >
        {current === 'mixed' && choice === 'inclusive'
          ? TAX_SETTING_MIXED
          : TAX_SETTING_HINTS[choice]}
      </Text>
    </Box>
  )
}
