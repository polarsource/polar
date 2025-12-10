import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Avatar } from '../Shared/Avatar'
import { ThemedText } from '../Shared/ThemedText'

export interface CustomerRowProps {
  customer: schemas['Customer']
}

export const CustomerRow = ({ customer }: CustomerRowProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/customers/${customer.id}`}
      style={[styles.container, { backgroundColor: theme.colors.card }]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <Avatar image={customer.avatar_url} name={customer.email} size={40} />
        <Box flex={1} flexDirection="column" gap="spacing-2">
          <ThemedText style={styles.name}>{customer.name ?? '—'}</ThemedText>
          <Box flexDirection="row" gap="spacing-4">
            <ThemedText style={styles.metadata} secondary>
              {customer.email}
            </ThemedText>
          </Box>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  metadata: {
    fontSize: 16,
  },
})
