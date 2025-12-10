import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { Button, ButtonProps } from './Button'
import { ThemedText } from './ThemedText'

export interface BannerProps {
  title: string
  description: string
  button?: ButtonProps
}

export const Banner = ({ title, description, button }: BannerProps) => {
  const theme = useTheme()
  return (
    <Box
      flexDirection="column"
      padding="spacing-16"
      borderRadius="border-radius-16"
      gap="spacing-16"
      backgroundColor="card"
    >
      <Box flex={1} gap="spacing-6">
        <ThemedText style={{ fontSize: 14 }}>{title}</ThemedText>
        <ThemedText style={{ fontSize: 14 }} secondary>
          {description}
        </ThemedText>
      </Box>
      {button && (
        <Button
          {...button}
          style={{
            paddingVertical: theme.spacing['spacing-8'],
            paddingHorizontal: theme.spacing['spacing-12'],
            borderRadius: theme.borderRadii['border-radius-100'],
            height: 32,
            alignSelf: 'flex-start',
          }}
          textStyle={{ fontSize: 12, fontWeight: 'normal' }}
        />
      )}
    </Box>
  )
}
