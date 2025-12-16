import { Chart } from '@/components/Metrics/Chart'
import {
  dateRangeToInterval,
  getPreviousParams,
  timeRange,
} from '@/components/Metrics/utils'
import { Box } from '@/components/Shared/Box'
import { Tabs, TabsList, TabsTrigger } from '@/components/Shared/Tabs'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import React, { useContext, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, SafeAreaView } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()
  const [selectedTimeInterval, setSelectedTimeInterval] =
    useState<keyof ReturnType<typeof timeRange>>('30d')

  const { startDate, endDate } = useMemo(() => {
    if (!organization) {
      return {
        startDate: new Date(),
        endDate: new Date(),
      }
    }

    return {
      startDate: timeRange(organization)[selectedTimeInterval].startDate,
      endDate: timeRange(organization)[selectedTimeInterval].endDate,
    }
  }, [selectedTimeInterval, organization])

  const previousPeriod = useMemo(() => {
    const previousParams = getPreviousParams(startDate)

    if (selectedTimeInterval === 'all_time') {
      return null
    }

    return {
      startDate: previousParams[selectedTimeInterval].startDate,
      endDate: previousParams[selectedTimeInterval].endDate,
    }
  }, [selectedTimeInterval, startDate])

  const metrics = useMetrics(organization?.id, startDate, endDate, {
    interval: dateRangeToInterval(startDate, endDate),
  })

  const previousMetrics = useMetrics(
    organization?.id,
    previousPeriod?.startDate ?? startDate,
    previousPeriod?.endDate ?? endDate,
    {
      interval: dateRangeToInterval(
        previousPeriod?.startDate ?? startDate,
        previousPeriod?.endDate ?? endDate,
      ),
    },
    !!previousPeriod,
  )

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Metrics',
        }}
      />
      <SafeAreaView style={{ margin: theme.spacing['spacing-16'] }}>
        <Tabs
          defaultValue={selectedTimeInterval}
          onValueChange={(value) =>
            setSelectedTimeInterval(value as keyof ReturnType<typeof timeRange>)
          }
        >
          {organization ? (
            <TabsList>
              {Object.entries(timeRange(organization)).map(([key, value]) => {
                return (
                  <TabsTrigger key={key} value={key}>
                    {value.title}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          ) : null}
        </Tabs>
      </SafeAreaView>
      {metrics.isLoading ? (
        <Box flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator />
        </Box>
      ) : (
        <FlashList
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexDirection: 'column',
            padding: theme.spacing['spacing-16'],
          }}
          ItemSeparatorComponent={() => <Box padding="spacing-8" />}
          data={
            Object.entries(metrics.data?.metrics ?? {}).map(
              ([metric, value]) => ({
                metric,
                value,
              }),
            ) as {
              metric: keyof schemas['MetricsTotals']
              value: schemas['Metric']
            }[]
          }
          renderItem={({ item }) => {
            return (
              <Chart
                key={item.metric}
                currentPeriodData={metrics.data}
                previousPeriodData={previousMetrics.data}
                title={item.value.display_name}
                metric={{
                  key: item.metric,
                  ...item.value,
                }}
                currentPeriod={{
                  startDate,
                  endDate,
                }}
                showPreviousPeriodTotal={selectedTimeInterval !== 'all_time'}
              />
            )
          }}
          keyExtractor={(item) => item.metric}
          refreshControl={
            <RefreshControl
              refreshing={metrics.isRefetching}
              onRefresh={metrics.refetch}
            />
          }
        />
      )}
    </>
  )
}
