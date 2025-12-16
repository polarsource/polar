import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useToast } from '@/providers/ToastProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Clipboard from 'expo-clipboard'
import { useCallback } from 'react'

interface LinkEmbedSectionProps {
  url: string
}

export const LinkEmbedSection = ({ url }: LinkEmbedSectionProps) => {
  const theme = useTheme()
  const toast = useToast()

  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(url)
    toast.showInfo('Copied to clipboard')
  }, [url, toast])

  return (
    <Box flexDirection="column" gap="spacing-12">
      <Touchable onPress={handleCopyLink}>
        <Box
          flexDirection="row"
          alignItems="center"
          padding="spacing-16"
          backgroundColor="card"
          borderRadius="border-radius-12"
          gap="spacing-12"
        >
          <Box flex={1}>
            <Text variant="body" numberOfLines={1} ellipsizeMode="middle">
              {url}
            </Text>
          </Box>
          <MaterialIcons
            name="content-copy"
            size={20}
            color={theme.colors.primary}
          />
        </Box>
      </Touchable>
    </Box>
  )
}
