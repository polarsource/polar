import { Box } from '@/components/Shared/Box'
import { Href } from 'expo-router'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

interface StatTileProps {
  title: string
  value?: number
  href: Href
  loading?: boolean
}

const StatTile = ({ title, value, href, loading }: StatTileProps) => (
  <Tile href={href} square={false}>
    <Box flex={1} flexDirection="column" justifyContent="space-between">
      <Text variant="body" color="subtext">
        {title}
      </Text>
      <Text
        variant="headlineLarge"
        numberOfLines={1}
        loading={loading || value === undefined}
        placeholderText="123"
      >
        {value?.toLocaleString('en-US')}
      </Text>
    </Box>
  </Tile>
)

export interface StatTilesProps {
  customerCount?: number
  subscriptionCount?: number
  orderCount?: number
  loading?: boolean
}

export const StatTiles = ({
  customerCount,
  subscriptionCount,
  orderCount,
  loading,
}: StatTilesProps) => (
  <>
    <Box flex={1}>
      <StatTile
        title="Customers"
        value={customerCount}
        href="/customers"
        loading={loading}
      />
    </Box>
    <Box flex={1}>
      <StatTile
        title="Subscriptions"
        value={subscriptionCount}
        href="/subscriptions"
        loading={loading}
      />
    </Box>
    <Box flex={1}>
      <StatTile
        title="Orders"
        value={orderCount}
        href="/orders"
        loading={loading}
      />
    </Box>
  </>
)
