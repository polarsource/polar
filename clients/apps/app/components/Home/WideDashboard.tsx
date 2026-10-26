import { Box } from '@/components/Shared/Box'
import { schemas } from '@polar-sh/client'
import { CatalogueTile } from './CatalogueTile'
import { FinanceTile } from './FinanceTile'
import { OrganizationTile } from './OrganizationTile'
import { RecentOrders, RecentSubscriptions } from './RecentActivity'
import { RevenueTile } from './RevenueTile'
import { StatTiles } from './StatTile'

const HERO_HEIGHT = 320
const STAT_HEIGHT = 132

export interface WideDashboardProps {
  loading: boolean
  loadingSubscriptions: boolean
  loadingOrders: boolean
  subscriptions: schemas['Subscription'][]
  orders: schemas['Order'][]
  subscriptionCount?: number
  orderCount?: number
  customerCount?: number
  stackLists?: boolean
  onOrganizationPress: () => void
}

export const WideDashboard = ({
  loading,
  loadingSubscriptions,
  loadingOrders,
  subscriptions,
  orders,
  subscriptionCount,
  orderCount,
  customerCount,
  stackLists,
  onOrganizationPress,
}: WideDashboardProps) => (
  <Box padding="spacing-16" gap="spacing-32" flexDirection="column">
    <Box gap="spacing-16" flexDirection="column">
      <Box flexDirection="row" gap="spacing-16" height={HERO_HEIGHT}>
        <Box flex={3}>
          <RevenueTile hero loading={loading} />
        </Box>
        <Box flex={2} flexDirection="column" gap="spacing-16">
          <Box flex={1}>
            <OrganizationTile
              square={false}
              onPress={onOrganizationPress}
              loading={loading}
            />
          </Box>
          <Box flex={1}>
            <FinanceTile square={false} loading={loading} />
          </Box>
        </Box>
      </Box>
      <Box flexDirection="row" gap="spacing-16" height={STAT_HEIGHT}>
        <Box flex={1}>
          <CatalogueTile square={false} loading={loading} />
        </Box>
        <StatTiles
          customerCount={customerCount}
          subscriptionCount={subscriptionCount}
          orderCount={orderCount}
          loading={loading}
        />
      </Box>
    </Box>
    <Box
      flexDirection={stackLists ? 'column' : 'row'}
      gap="spacing-32"
      alignItems={stackLists ? 'stretch' : 'flex-start'}
    >
      <RecentSubscriptions
        subscriptions={subscriptions}
        loading={loadingSubscriptions}
      />
      <RecentOrders orders={orders} loading={loadingOrders} />
    </Box>
  </Box>
)
