import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useMetrics } from '@/hooks/polar/metrics'
import { useProducts } from '@/hooks/polar/products'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { subDays } from 'date-fns'
import { useContext, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { ThemedText } from '../Shared/ThemedText'
import { Tile } from './Tile'

export const CatalogueTile = () => {
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
    <Tile href="/products">
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Box flexDirection="column" gap="spacing-4">
          <ThemedText style={[styles.subtitle]} secondary>
            Catalogue
          </ThemedText>
          <ThemedText style={[styles.title]}>
            {products?.items.length}{' '}
            {`${(products?.items.length ?? 0) > 1 ? 'Products' : 'Product'}`}
          </ThemedText>
        </Box>
        <Box flexDirection="column" gap="spacing-8">
          <Box
            flexDirection="row"
            justifyContent="space-between"
            gap="spacing-4"
          >
            <ThemedText style={[styles.subtitle]} secondary>
              Order Streak
            </ThemedText>
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
                  height: 10,
                  width: 10,
                  backgroundColor:
                    (period.orders ?? 0) > 0
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderRadius: 10,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Tile>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 26,
  },
})
