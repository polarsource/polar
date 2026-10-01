'use client'

import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { TaxBehavior } from '../../bulkTax/bulkTaxRecords'
import {
  APPLIED_LABEL,
  APPLY_LABEL,
  TAX_SETTING_HINTS,
  TAX_SETTING_LABELS,
  TAX_SETTING_MIXED,
} from './taxSettingCopy'
import { initialChoice, TaxOptionProps } from './useTaxSetting'

const CHOICES: TaxBehavior[] = ['inclusive', 'exclusive']

export function TaxOptionCards({ current, canApply, onApply }: TaxOptionProps) {
  const [choice, setChoice] = useState(initialChoice(current))

  return (
    <Box flexDirection="column" rowGap="m">
      <Box role="radiogroup" flexDirection="column" rowGap="s">
        {CHOICES.map((value) => {
          const selected = value === choice
          return (
            <Box
              key={value}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => setChoice(value)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') setChoice(value)
              }}
              alignItems="start"
              justifyContent="between"
              columnGap="m"
              padding="l"
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor={
                selected
                  ? 'background-card'
                  : {
                      base: 'background-primary',
                      hover: 'background-secondary',
                    }
              }
              cursor="pointer"
            >
              <Box flexDirection="column" rowGap="xs">
                <Text>{TAX_SETTING_LABELS[value]}</Text>
                <Text
                  variant="caption"
                  color={
                    value === 'exclusive' && selected ? 'warning' : 'muted'
                  }
                >
                  {TAX_SETTING_HINTS[value]}
                </Text>
              </Box>
              {selected ? <Check size={16} /> : null}
            </Box>
          )
        })}
      </Box>
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text variant="caption" color="muted">
          {current === 'mixed' ? TAX_SETTING_MIXED : ''}
        </Text>
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
