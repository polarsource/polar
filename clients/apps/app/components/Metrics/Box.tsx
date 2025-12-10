import { Box as RestyleBox } from '@/components/Shared/Box'
import { StyleSheet } from 'react-native'
import { ThemedText } from '../Shared/ThemedText'

export interface BoxProps {
  label: string
  value: string
}

export const Box = ({ label, value }: BoxProps) => {
  return (
    <RestyleBox
      flex={1}
      padding="spacing-12"
      borderRadius="border-radius-12"
      gap="spacing-8"
      backgroundColor="card"
    >
      <ThemedText style={styles.label} secondary>
        {label}
      </ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </RestyleBox>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
})
