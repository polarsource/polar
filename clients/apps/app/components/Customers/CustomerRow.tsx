import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { Avatar } from '../Shared/Avatar'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface CustomerRowProps {
  customer: schemas['Customer']
}

export const CustomerRow = ({ customer }: CustomerRowProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/customers/${customer.id}`}
      style={{
        padding: theme.spacing['spacing-16'],
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: theme.borderRadii['border-radius-12'],
        gap: theme.spacing['spacing-12'],
        backgroundColor: theme.colors.card,
      }}
      asChild
    >
      <Touchable>
        <Avatar image={customer.avatar_url} name={customer.email} size={40} />
        <Box flex={1} flexDirection="column" gap="spacing-2">
          <Text variant="bodyMedium">{customer.name ?? '—'}</Text>
          <Box flexDirection="row" gap="spacing-4">
            <Text color="subtext">{customer.email}</Text>
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
