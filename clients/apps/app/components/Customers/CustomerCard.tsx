import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { Dimensions } from 'react-native'
import { Avatar } from '../Shared/Avatar'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface CustomerCardProps {
  customer?: schemas['Customer']
  loading?: boolean
}

export const CustomerCard = ({ customer, loading }: CustomerCardProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/customers/${customer?.id}`}
      style={{
        paddingVertical: theme.spacing['spacing-32'],
        paddingHorizontal: theme.spacing['spacing-16'],
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing['spacing-32'],
        borderRadius: theme.borderRadii['border-radius-16'],
        width: Dimensions.get('screen').width * 0.66,
        backgroundColor: theme.colors.card,
      }}
      asChild
    >
      <Touchable>
        <Avatar
          size={64}
          name={customer?.name || customer?.email || ''}
          image={customer?.avatar_url ?? undefined}
          loading={loading}
        />
        <Box flexDirection="column" gap="spacing-8">
          <Text loading={loading} textAlign="center" placeholderText="John Doe">
            {customer?.name ?? '—'}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            ellipsizeMode="tail"
            textAlign="center"
            color="subtext"
            loading={loading}
            placeholderText="johndoe@example.com"
          >
            {customer?.email}
          </Text>
        </Box>
      </Touchable>
    </Link>
  )
}
