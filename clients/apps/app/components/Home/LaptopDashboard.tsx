import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import type { DivisionRegion } from '@/modules/duo-hinge'
import { ScrollView } from 'react-native'
import { RecentOrders, RecentSubscriptions } from './RecentActivity'
import { RevenueStage } from './RevenueStage'
import { StatTiles } from './StatTile'
import type { WideDashboardProps } from './WideDashboard'

const STAT_HEIGHT = 120

export interface LaptopDashboardProps extends Omit<
  WideDashboardProps,
  'stackLists' | 'onOrganizationPress'
> {
  division: DivisionRegion
  foldProgress: number
  headerHeight: number
}

export const LaptopDashboard = ({
  division,
  foldProgress,
  headerHeight,
  loading,
  loadingSubscriptions,
  loadingOrders,
  subscriptions,
  orders,
  subscriptionCount,
  orderCount,
  customerCount,
}: LaptopDashboardProps) => {
  const theme = useTheme()

  return (
    <Box flex={1} flexDirection="column">
      <Box height={division.y}>
        <RevenueStage paddingTop={headerHeight} foldProgress={foldProgress} />
      </Box>
      <Box height={division.height} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
          gap: theme.spacing['spacing-24'],
        }}
      >
        <Box flexDirection="row" gap="spacing-16" height={STAT_HEIGHT}>
          <StatTiles
            customerCount={customerCount}
            subscriptionCount={subscriptionCount}
            orderCount={orderCount}
            loading={loading}
          />
        </Box>
        <Box flexDirection="row" gap="spacing-32" alignItems="flex-start">
          <RecentSubscriptions
            subscriptions={subscriptions}
            loading={loadingSubscriptions}
          />
          <RecentOrders orders={orders} loading={loadingOrders} />
        </Box>
      </ScrollView>
    </Box>
  )
}
