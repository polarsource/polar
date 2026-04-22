import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useToast } from '@/providers/ToastProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import * as Clipboard from 'expo-clipboard'

const numberFormat = new Intl.NumberFormat(undefined, {})

type CustomFieldValueType = string | number | boolean | null | undefined

interface Props {
  field: schemas['CustomField']
  value: CustomFieldValueType
}

export const CustomField = ({ field, value }: Props) => {
  const theme = useTheme()
  const toast = useToast()

  const renderValue = () => {
    if (value === undefined || value === null) {
      return <Text>—</Text>
    }

    if (field.type === 'checkbox') {
      return (
        <MaterialIcons
          color={theme.colors.text}
          name={value === true ? 'check' : 'close'}
          size={16}
        />
      )
    }

    const text = formatText(field, value)

    return (
      <Touchable
        onPress={() => {
          Clipboard.setStringAsync(text)
          toast.showInfo('Copied to clipboard')
        }}
      >
        <Text>{text}</Text>
      </Touchable>
    )
  }

  return (
    <Box gap="spacing-4">
      <Text color="subtext">{field.name}</Text>
      {renderValue()}
    </Box>
  )
}

const formatText = (
  field: schemas['CustomField'],
  value: Exclude<CustomFieldValueType, null | undefined>,
): string => {
  switch (field.type) {
    case 'number':
      return numberFormat.format(value as number)
    case 'date':
      return new Date(value as string).toLocaleDateString('en-US', {
        dateStyle: 'medium',
      })
    case 'select':
      return (
        field.properties.options.find((option) => option.value === value)
          ?.label ?? String(value)
      )
    case 'text':
    default:
      return String(value)
  }
}
