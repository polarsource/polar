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
  APPLIED_LABEL,
  APPLY_LABEL,
  TAX_SETTING_HINTS,
  TAX_SETTING_MIXED,
} from './taxSettingCopy'
import { initialChoice, TaxOptionProps } from './useTaxSetting'

const PHRASES: Record<TaxBehavior, string> = {
  inclusive: 'the same price, with tax included',
  exclusive: 'the price plus tax',
}

export function TaxOptionSentence({
  current,
  canApply,
  onApply,
}: TaxOptionProps) {
  const [choice, setChoice] = useState(initialChoice(current))

  return (
    <Box flexDirection="column" rowGap="m">
      <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
        <Text>After the switch, customers pay</Text>
        <Box width={280}>
          <Select
            value={choice}
            onValueChange={(value) => setChoice(value as TaxBehavior)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inclusive">{PHRASES.inclusive}</SelectItem>
              <SelectItem value="exclusive">{PHRASES.exclusive}</SelectItem>
            </SelectContent>
          </Select>
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
      <Box justifyContent="end">
        <Button
          size="sm"
          onClick={() => onApply(choice)}
          disabled={!canApply(choice)}
        >
          {canApply(choice) ? APPLY_LABEL : APPLIED_LABEL}
        </Button>
      </Box>
    </Box>
  )
}
