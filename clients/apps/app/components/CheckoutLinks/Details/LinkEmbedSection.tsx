import { Box } from '@/components/Shared/Box'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/Shared/Tabs'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useMemo } from 'react'
import { Alert } from 'react-native'

interface LinkEmbedSectionProps {
  url: string
}

export const LinkEmbedSection = ({ url }: LinkEmbedSectionProps) => {
  const theme = useTheme()

  const checkoutEmbed = useMemo(() => {
    return `<a href="${url}" data-polar-checkout data-polar-checkout-theme="dark">Purchase</a>
<script src="https://cdn.polar.sh/checkout/embed.global.js" defer data-auto-init></script>`
  }, [url])

  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(url)
    Alert.alert('Copied', 'Checkout link copied to clipboard')
  }, [url])

  const handleCopyEmbed = useCallback(async () => {
    await Clipboard.setStringAsync(checkoutEmbed)
    Alert.alert('Copied', 'Embed code copied to clipboard')
  }, [checkoutEmbed])

  return (
    <Box flexDirection="column" gap="spacing-12">
      <Tabs defaultValue="link">
        <TabsList>
          <TabsTrigger value="link">Link</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        <TabsContent
          value="link"
          style={{ marginTop: theme.spacing['spacing-12'] }}
        >
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
        </TabsContent>

        <TabsContent
          value="embed"
          style={{ marginTop: theme.spacing['spacing-12'] }}
        >
          <Touchable onPress={handleCopyEmbed}>
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
                  {checkoutEmbed}
                </Text>
              </Box>
              <MaterialIcons
                name="content-copy"
                size={20}
                color={theme.colors.primary}
              />
            </Box>
          </Touchable>
        </TabsContent>
      </Tabs>
    </Box>
  )
}
