import { Input } from '@/components/Shared/Input'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useSearch } from '@/hooks/polar/search'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { Stack } from 'expo-router'
import React, { useContext, useState } from 'react'
import { FlatList, View } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()

  const [search, setSearch] = useState('')

  const { data, refetch, isRefetching } = useSearch(organization?.id, {
    query: search,
  })

  console.log(data)

  return (
    <>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={{ padding: 16, backgroundColor: colors.background }}>
        <Input
          placeholder="Search"
          onChangeText={setSearch}
          placeholderTextColor={colors.subtext}
        />
      </View>
      <FlatList
        data={data?.results ?? []}
        renderItem={({
          item,
        }: {
          item:
            | schemas['SearchResultProduct']
            | schemas['SearchResultCustomer']
            | schemas['SearchResultOrder']
            | schemas['SearchResultSubscription']
        }) => {
          return <ThemedText>{item.type}</ThemedText>
        }}
      />
    </>
  )
}
