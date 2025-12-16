import { CustomerRow } from '@/components/Customers/CustomerRow'
import { Box } from '@/components/Shared/Box'
import { Input } from '@/components/Shared/Input'
import { useTheme } from '@/design-system/useTheme'
import { useCustomers } from '@/hooks/polar/customers'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import React, { useContext, useMemo, useState } from 'react'
import { RefreshControl } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()
  const [search, setSearch] = useState('')

  const { data, refetch, isRefetching, fetchNextPage, hasNextPage } =
    useCustomers(organization?.id, { query: search })

  const customersData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Customers',
        }}
      />
      <Box padding="spacing-16" backgroundColor="background">
        <Input
          placeholder="Search Customers"
          onChangeText={setSearch}
          placeholderTextColor={theme.colors.subtext}
        />
      </Box>
      <FlashList
        data={customersData}
        renderItem={({ item }: { item: schemas['Customer'] }) => {
          return <CustomerRow customer={item} />
        }}
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
          backgroundColor: theme.colors.background,
        }}
        ItemSeparatorComponent={() => (
          <Box style={{ height: theme.dimension['dimension-6'] }} />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
        }
        onEndReached={() => {
          if (hasNextPage) {
            fetchNextPage()
          }
        }}
        onEndReachedThreshold={0.8}
      />
    </>
  )
}
