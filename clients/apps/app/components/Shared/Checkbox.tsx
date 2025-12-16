import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { Text } from './Text'
import { Touchable } from './Touchable'

export interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Checkbox = ({ label, checked, onChange }: CheckboxProps) => {
  const theme = useTheme()

  return (
    <Touchable
      onPress={() => onChange(!checked)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing['spacing-8'],
      }}
      activeOpacity={0.6}
    >
      <Box
        width={20}
        height={20}
        borderRadius="border-radius-full"
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderColor="border"
      >
        {checked ? (
          <Box
            width={12}
            height={12}
            borderRadius="border-radius-full"
            backgroundColor="monochromeInverted"
          />
        ) : null}
      </Box>
      <Text color={checked ? 'text' : 'subtext'}>{label}</Text>
    </Touchable>
  )
}
