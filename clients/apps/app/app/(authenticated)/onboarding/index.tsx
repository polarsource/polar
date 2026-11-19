import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useLogout } from '@/hooks/auth'
import { queryClient } from '@/utils/query'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, SafeAreaView, ScrollView } from 'react-native'

export default function Onboarding() {
  const theme = useTheme()
  const router = useRouter()
  const signOut = useLogout()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      await queryClient.refetchQueries({ queryKey: ['organizations'] })
      router.replace('/')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: theme.colors.background,
        paddingBottom: theme.spacing['spacing-16'],
      }}
    >
      <Stack.Screen
        options={{
          header: () => null,
        }}
      />
      <SafeAreaView
        style={{
          margin: theme.spacing['spacing-16'],
          gap: theme.spacing['spacing-32'],
        }}
      >
        <Box gap="spacing-16">
          <Text
            variant="display"
            style={{
              paddingVertical: theme.spacing['spacing-32'],
            }}
          >
            Create your organization
          </Text>
          <Text color="subtext">
            Set up your organization on polar.sh. Come back here to follow your
            sales and get notified of new orders.
          </Text>
        </Box>

        <Box gap="spacing-8">
          <Box>
            <Button onPress={() => Linking.openURL('https://polar.sh/start')}>
              Continue on polar.sh
            </Button>
          </Box>
          <Box>
            <Button
              variant="secondary"
              onPress={refresh}
              loading={isRefreshing}
            >
              I&apos;ve created it
            </Button>
          </Box>
          <Box alignItems="center" marginTop="spacing-12">
            <Touchable onPress={signOut}>
              <Text color="subtext" variant="bodyMedium">
                Logout
              </Text>
            </Touchable>
          </Box>
        </Box>
      </SafeAreaView>
    </ScrollView>
  )
}
