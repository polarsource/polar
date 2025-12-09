import { CustomerRow } from '@/components/Customers/CustomerRow'
import { Input } from '@/components/Shared/Input'
import { useCustomers } from '@/hooks/polar/customers'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import React, { useContext, useMemo, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()
  const [search, setSearch] = useState('')

  const { data, refetch, isRefetching, fetchNextPage, hasNextPage } =
    useCustomers(organization?.id, { query: search })

  const customersData = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  return (
    <>
      <View style={{ padding: 16, backgroundColor: colors.background }}>
        <Input
          placeholder="Search Customers"
          onChangeText={setSearch}
          placeholderTextColor={colors.subtext}
        />
      </View>
      <FlatList
        data={customersData}
        renderItem={({ item }: { item: schemas['Customer'] }) => {
          return <CustomerRow customer={item} />
        }}
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
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
