import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'
import { Touchable } from '../Shared/Touchable'

export interface OrderRowProps {
  order?: schemas['Order']
  showTimestamp?: boolean
  style?: StyleProp<TextStyle>
  loading?: boolean
}

export const OrderRow = ({
  order,
  style,
  showTimestamp,
  loading,
}: OrderRowProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/orders/${order?.id}`}
      style={[
        {
          padding: theme.spacing['spacing-16'],
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.borderRadii['border-radius-12'],
          gap: theme.spacing['spacing-12'],
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
      asChild
    >
      <Touchable>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Text variant="bodyMedium" loading={loading}>
            {order?.product?.name}
          </Text>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            {showTimestamp ? (
              <>
                <Text
                  color="subtext"
                  loading={loading}
                  placeholderText="12/12/2025"
                >
                  {new Date(order?.created_at || new Date()).toLocaleDateString(
                    'en-US',
                    {
                      dateStyle: 'medium',
                    },
                  )}
                </Text>
                {loading ? null : <Text color="subtext">•</Text>}
              </>
            ) : null}
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, flexWrap: 'wrap' }}
              color="subtext"
            >
              {order?.customer.name || order?.customer.email}
            </Text>
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
