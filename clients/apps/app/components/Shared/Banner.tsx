import { Box } from '@/components/Shared/Box'
import { StyleSheet } from 'react-native'
import { Button, ButtonProps } from './Button'
import { ThemedText } from './ThemedText'

export interface BannerProps {
  title: string
  description: string
  button?: ButtonProps
}

export const Banner = ({ title, description, button }: BannerProps) => {
  return (
    <Box
      flexDirection="column"
      padding="spacing-16"
      borderRadius="border-radius-16"
      gap="spacing-16"
      backgroundColor="card"
    >
      <Box flex={1} gap="spacing-6">
        <ThemedText style={[styles.title]}>{title}</ThemedText>
        <ThemedText style={[styles.description]} secondary>
          {description}
        </ThemedText>
      </Box>
      {button && (
        <Button
          {...button}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      )}
    </Box>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 100,
    height: 32,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: 'normal',
  },
})
