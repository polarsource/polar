import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { useProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { subDays } from 'date-fns'
import { useContext, useMemo } from 'react'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface CatalogueTileProps {
  loading?: boolean
}

export const CatalogueTile = ({ loading }: CatalogueTileProps) => {
  const theme = useTheme()

  const { organization } = useContext(OrganizationContext)
  const { data: products } = useProducts(organization?.id, {
    limit: 100,
  })

  const startDate = useMemo(() => {
    return subDays(new Date(), 6)
  }, [])

  const endDate = useMemo(() => {
    return new Date()
  }, [])

  const metrics = useMetrics(organization?.id, startDate, endDate, {
    interval: 'day',
  })

  return (
    <Tile href="/catalogue">
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Box flexDirection="column" gap="spacing-4">
          <Text variant="body" color="subtext">
            Catalogue
          </Text>
          <Text variant="body" loading={loading} placeholderText="10 Products">
            {products?.items.length}{' '}
            {`${(products?.items.length ?? 0) > 1 ? 'Products' : 'Product'}`}
          </Text>
        </Box>
        <Box flexDirection="column" gap="spacing-8">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-4"
          >
            <Text variant="body" color="subtext">
              Order Streak
            </Text>
          </Box>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-4"
          >
            {metrics.data?.periods.map((period) => (
              <Box
                key={period.timestamp.toISOString()}
                style={{
                  height: theme.dimension['dimension-10'],
                  width: theme.dimension['dimension-10'],
                  backgroundColor:
                    (period.orders ?? 0) > 0
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderRadius: theme.borderRadii['border-radius-10'],
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Tile>
  )
}
