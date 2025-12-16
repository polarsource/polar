import { Box } from '@/components/Shared/Box'
import { Input } from '@/components/Shared/Input'
import { useTheme } from '@/design-system/useTheme'
import {
  Control,
  FieldValues,
  useController,
  UseControllerProps,
} from 'react-hook-form'
import { TextInputProps } from 'react-native'
import { Text } from '../Shared/Text'

export type FormInputProps<T extends FieldValues> = TextInputProps & {
  control: Control<T>
  name: UseControllerProps<T>['name']
  defaultValue?: UseControllerProps<T>['defaultValue']
  label?: string
  secondaryLabel?: string
}

export const FormInput = <T extends FieldValues>({
  control,
  name,
  defaultValue,
  label,
  secondaryLabel,
  ...props
}: FormInputProps<T>) => {
  const { field } = useController({ control, name, defaultValue })
  const theme = useTheme()

  if (label) {
    return (
      <Box flexDirection="column" gap="spacing-8">
        <Box flexDirection="row" gap="spacing-8" justifyContent="space-between">
          <Text color="subtext">{label}</Text>
          {secondaryLabel ? (
            <Text color="subtext">{secondaryLabel}</Text>
          ) : null}
        </Box>
        <Input value={field.value} onChangeText={field.onChange} {...props} />
      </Box>
    )
  }

  return (
    <Input
      value={field.value}
      onChangeText={field.onChange}
      placeholderTextColor={theme.colors.subtext}
      {...props}
    />
  )
}
