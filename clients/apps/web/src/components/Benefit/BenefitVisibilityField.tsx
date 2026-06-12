'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useFormContext } from 'react-hook-form'

type BenefitVisibilityFormValues = {
  visibility?: schemas['BenefitVisibility']
}

interface BenefitVisibilityOptionProps {
  id: string
  value: schemas['BenefitVisibility']
  selected: boolean
  label: string
  description: string
}

const BenefitVisibilityOption = ({
  id,
  value,
  selected,
  label,
  description,
}: BenefitVisibilityOptionProps) => (
  <Box
    as="label"
    htmlFor={id}
    flexDirection="column"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    padding="l"
    backgroundColor={
      selected
        ? 'background-card'
        : { base: 'background-secondary', hover: 'background-card' }
    }
    transitionProperty="colors"
    transitionDuration="base"
    cursor={{ hover: 'pointer' }}
  >
    <Box alignItems="center" columnGap="s">
      <RadioGroupItem value={value} id={id} />
      <Text
        variant="default"
        color={selected ? 'default' : 'muted'}
        className="font-medium"
      >
        {label}
      </Text>
    </Box>
    <Text variant="default" color="muted" className="pt-1">
      {description}
    </Text>
  </Box>
)

interface BenefitVisibilityFieldProps {
  defaultValue?: schemas['BenefitVisibility']
}

export const BenefitVisibilityField = ({
  defaultValue,
}: BenefitVisibilityFieldProps) => {
  const { control } = useFormContext<BenefitVisibilityFormValues>()

  return (
    <FormField
      control={control}
      name="visibility"
      shouldUnregister
      defaultValue={defaultValue}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Visibility</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid grid-cols-1 gap-3"
            >
              <BenefitVisibilityOption
                id="benefit-visibility-public"
                value="public"
                selected={field.value === 'public'}
                label="Visible"
                description="Customers can see this benefit in customer-facing product and benefit lists."
              />
              <BenefitVisibilityOption
                id="benefit-visibility-private"
                value="private"
                selected={field.value === 'private'}
                label="Hidden"
                description="Still granted after purchase, but not visible in customer-facing product or benefit lists."
              />
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
