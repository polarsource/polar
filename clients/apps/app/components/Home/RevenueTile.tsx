import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useCumulativeRevenue } from '@/hooks/useCumulativeRevenue'
import { formatCurrency } from '@polar-sh/currency'
import { CartesianChart, Line } from 'victory-native'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface RevenueTileProps {
  loading?: boolean
  hero?: boolean
}

export const RevenueTile = ({ loading, hero }: RevenueTileProps) => {
  const theme = useTheme()
  const { data, maxValue, total, lineProgress } = useCumulativeRevenue()

  return (
    <Tile href="/metrics" square={!hero}>
      <Box
        flex={1}
        flexDirection="column"
        justifyContent="space-between"
        gap="spacing-4"
      >
        <Box flexDirection="column" gap="spacing-4">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-4"
          >
            <Text variant="body" color="subtext">
              Revenue
            </Text>
          </Box>
          <Text variant="body">{hero ? 'Last 30 days' : '30 Days'}</Text>
        </Box>
        {data.length > 0 ? (
          <Box flex={1} flexGrow={1} width="100%">
            <CartesianChart
              data={data}
              xKey="index"
              yKeys={['value']}
              domain={{ y: [0, maxValue] }}
              domainPadding={{ bottom: 4, top: 4 }}
              axisOptions={{
                lineColor: 'transparent',
                labelColor: 'transparent',
              }}
              frame={{ lineColor: 'transparent' }}
            >
              {({ points }) => (
                <Line
                  points={points.value}
                  color={theme.colors.primary}
                  strokeWidth={hero ? 3 : 2}
                  curveType="monotoneX"
                  end={lineProgress}
                />
              )}
            </CartesianChart>
          </Box>
        ) : null}
        <Text
          variant={hero ? 'display' : 'headline'}
          numberOfLines={1}
          loading={loading}
          placeholderText="$1,234"
        >
          {formatCurrency('statistics')(total, 'usd')}
        </Text>
      </Box>
    </Tile>
  )
}
