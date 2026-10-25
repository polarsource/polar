'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { RadioGroupItem } from '@polar-sh/ui/components/ui/radio-group'

interface BenefitRadioOptionProps {
  id: string
  value: string
  selected: boolean
  label: string
  description: string
}

export const BenefitRadioOption = ({
  id,
  value,
  selected,
  label,
  description,
}: BenefitRadioOptionProps) => (
  <Box
    as="label"
    htmlFor={id}
    flexDirection="column"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    display="flex"
    padding="l"
    backgroundColor={
      selected
        ? 'background-card'
        : { base: 'background-secondary', hover: 'background-card' }
    }
    transitionProperty="colors"
    transitionDuration="base"
    cursor={{ hover: 'pointer' }}
    rowGap="xs"
  >
    <Box alignItems="center" columnGap="s">
      <RadioGroupItem value={value} id={id} />
      <Text variant="default" color={selected ? 'default' : 'muted'}>
        {label}
      </Text>
    </Box>
    <Box>
      <Text variant="default" color="muted">
        {description}
      </Text>
    </Box>
  </Box>
)
