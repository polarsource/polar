import { useTheme } from '@/hooks/theme'
import { schemas } from '@polar-sh/client'
import { Link } from 'expo-router'
import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Avatar } from '../Shared/Avatar'
import { ThemedText } from '../Shared/ThemedText'

export interface CustomerRowProps {
  customer: schemas['Customer']
}

export const CustomerRow = ({ customer }: CustomerRowProps) => {
  const { colors } = useTheme()

  return (
    <Link
      href={`/customers/${customer.id}`}
      style={[styles.container, { backgroundColor: colors.card }]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <Avatar image={customer.avatar_url} name={customer.email} size={40} />
        <View style={styles.contentContainer}>
          <ThemedText style={[styles.name]}>{customer.name ?? '—'}</ThemedText>
          <View style={styles.metadataContainer}>
            <ThemedText style={[styles.metadata]} secondary>
              {customer.email}
            </ThemedText>
          </View>
        </View>
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
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  email: {
    fontSize: 16,
  },
  metadata: {
    fontSize: 16,
  },
  metadataContainer: {
    flexDirection: 'row',
    gap: 4,
  },
})
