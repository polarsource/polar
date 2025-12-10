import { useTheme } from '@/design-system/useTheme'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { ThemedText } from './ThemedText'

export interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Checkbox = ({ label, checked, onChange }: CheckboxProps) => {
  const theme = useTheme()

  return (
    <TouchableOpacity
      onPress={() => onChange(!checked)}
      style={styles.container}
      activeOpacity={0.6}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: theme.colors.border,
          },
        ]}
      >
        {checked && (
          <View
            style={[
              styles.checkboxChecked,
              {
                backgroundColor: theme.colors.monochromeInverted,
              },
            ]}
          />
        )}
      </View>
      <ThemedText style={styles.label} secondary={!checked}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  label: {
    fontSize: 16,
  },
})
