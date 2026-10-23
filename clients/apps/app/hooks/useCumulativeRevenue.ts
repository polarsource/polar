import { useMetrics } from '@/hooks/polar/metrics'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { subDays } from 'date-fns'
import { useContext, useEffect, useMemo } from 'react'
import { useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

const animatedOrganizations = new Set<string>()

export const useCumulativeRevenue = () => {
  const { organization } = useContext(OrganizationContext)
  const organizationId = organization?.id

  const startDate = useMemo(() => subDays(new Date(), 29), [])
  const endDate = useMemo(() => new Date(), [])

  const metrics = useMetrics(organizationId, startDate, endDate, {
    interval: 'day',
  })

  const data = useMemo(() => {
    return (
      metrics.data?.periods.reduce<{ value: number; index: number }[]>(
        (acc, period, index) => [
          ...acc,
          {
            value: (acc[acc.length - 1]?.value ?? 0) + (period.revenue ?? 0),
            index,
          },
        ],
        [],
      ) ?? []
    )
  }, [metrics])

  const maxValue = useMemo(() => {
    if (data.length === 0) return 1
    return Math.max(...data.map((d) => d.value), 1)
  }, [data])

  const lineProgress = useSharedValue(
    organizationId && animatedOrganizations.has(organizationId) ? 1 : 0,
  )

  useEffect(() => {
    if (!organizationId || data.length === 0) return
    if (animatedOrganizations.has(organizationId)) {
      lineProgress.set(1)
      return
    }
    animatedOrganizations.add(organizationId)
    lineProgress.set(0)
    lineProgress.set(withDelay(500, withTiming(1, { duration: 800 })))
  }, [organizationId, data.length, lineProgress])

  return {
    data,
    maxValue,
    total: metrics.data?.totals.revenue ?? 0,
    lineProgress,
  }
}
