import { Box as RestyleBox } from '@/components/Shared/Box'
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
      <ThemedText style={{ fontSize: 16 }} secondary>
        {label}
      </ThemedText>
      <ThemedText style={{ fontSize: 16 }}>{value}</ThemedText>
    </RestyleBox>
  )
}
