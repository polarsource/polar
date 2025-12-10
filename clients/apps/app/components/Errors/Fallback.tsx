import React, { useMemo } from 'react'
import { TouchableOpacity } from 'react-native'

import { Box } from '@/components/Shared/Box'
import PolarLogo from '@/components/Shared/PolarLogo'
import { useTheme } from '@/design-system/useTheme'
import { useLogout } from '@/hooks/auth'
import { useOAuth } from '@/hooks/oauth'
import { isValidationError, UnauthorizedResponseError } from '@polar-sh/client'
import { Text } from '../Shared/Text'
export interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export const ErrorFallback = ({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) => {
  const theme = useTheme()
  const logout = useLogout()
  const { authenticate } = useOAuth()
  const permissionError =
    error instanceof UnauthorizedResponseError ||
    (isValidationError(error) &&
      error.message.includes('insufficient_scope')) ||
    (error instanceof Error && error.message.includes('privileges'))

  const title = useMemo(() => {
    switch (true) {
      case permissionError:
        return 'Insufficient Permissions'
      default:
        return 'Something Went Wrong'
    }
  }, [permissionError])

  const message = useMemo(() => {
    switch (true) {
      case permissionError:
        return 'You have insufficient permissions to access the resource. Authenticate to gain the necessary permissions.'
      default:
        return 'Logout & re-authenticate to try again'
    }
  }, [permissionError])

  const [actionText, action] = useMemo(() => {
    switch (true) {
      case permissionError:
        return ['Authenticate', authenticate]
      default:
        return ['Logout', logout]
    }
  }, [permissionError, logout, authenticate])

  return (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      backgroundColor="background"
      gap="spacing-32"
      paddingHorizontal="spacing-24"
    >
      <PolarLogo size={80} />
      <Box gap="spacing-12">
        <Text variant="titleLarge" textAlign="center">
          {title}
        </Text>
        <Text color="subtext" textAlign="center">
          {message}
        </Text>
      </Box>
      <TouchableOpacity
        activeOpacity={0.6}
        style={{
          backgroundColor: '#fff',
          borderRadius: 100,
          width: 'auto',
          paddingVertical: 12,
          paddingHorizontal: 24,
        }}
        onPress={async () => {
          await action()
          resetErrorBoundary()
        }}
      >
        <Text variant="bodyMedium" style={{ color: '#000' }}>
          {actionText}
        </Text>
      </TouchableOpacity>
    </Box>
  )
}
