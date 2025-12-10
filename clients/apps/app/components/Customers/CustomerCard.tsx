import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { Dimensions, StyleSheet, TouchableOpacity } from 'react-native'
import { Avatar } from '../Shared/Avatar'
import { ThemedText } from '../Shared/ThemedText'

export interface CustomerCardProps {
  customer: schemas['Customer']
}

export const CustomerCard = ({ customer }: CustomerCardProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/customers/${customer.id}`}
      style={[styles.container, { backgroundColor: theme.colors.card }]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <Avatar
          size={64}
          name={customer.name ?? customer.email}
          image={customer.avatar_url ?? undefined}
        />
        <Box flexDirection="column" alignItems="center" gap="spacing-8">
          <ThemedText style={[styles.name]}>{customer.name ?? '—'}</ThemedText>
          <ThemedText
            style={[styles.email]}
            numberOfLines={1}
            ellipsizeMode="tail"
            secondary
          >
            {customer.email}
          </ThemedText>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    borderRadius: 16,
    width: Dimensions.get('screen').width * 0.66,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    textAlign: 'center',
  },
})
