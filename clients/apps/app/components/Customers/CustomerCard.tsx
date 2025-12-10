import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { Dimensions, TouchableOpacity } from 'react-native'
import { Avatar } from '../Shared/Avatar'
import { Text } from '../Shared/Text'

export interface CustomerCardProps {
  customer: schemas['Customer']
}

export const CustomerCard = ({ customer }: CustomerCardProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/customers/${customer.id}`}
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
      <TouchableOpacity activeOpacity={0.6}>
        <Avatar
          size={64}
          name={customer.name ?? customer.email}
          image={customer.avatar_url ?? undefined}
        />
        <Box flexDirection="column" alignItems="center" gap="spacing-8">
          <Text textAlign="center">{customer.name ?? '—'}</Text>
          <Text
            variant="bodySmall"
            textAlign="center"
            numberOfLines={1}
            ellipsizeMode="tail"
            color="subtext"
          >
            {customer.email}
          </Text>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}
