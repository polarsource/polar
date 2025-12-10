import { Box as RestyleBox } from '@/components/Shared/Box'
import { Text } from '../Shared/Text'

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
      <Text color="subtext">{label}</Text>
      <Text>{value}</Text>
    </RestyleBox>
  )
}
