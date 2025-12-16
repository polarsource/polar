import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { formatCurrencyAndAmount } from '@/utils/money'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'expo-router'
import React, { useEffect, useMemo } from 'react'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

type ActivityType = 'order' | 'subscription'

interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  amount?: number
  currency?: string
  status?: string
  timestamp: Date
  href: string
}

interface ActivityFeedProps {
  orders?: schemas['Order'][]
  subscriptions?: schemas['Subscription'][]
  loading?: boolean
}

const ActivityRow = ({
  item,
  index,
}: {
  item: ActivityItem
  index: number
}) => {
  const theme = useTheme()

  const icon = item.type === 'order' ? 'receipt-long' : 'autorenew'
  const iconColor =
    item.type === 'order' ? theme.colors.statusGreen : theme.colors.primary

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Link href={item.href as `${string}:${string}`} asChild>
        <Touchable>
          <Box
            flexDirection="row"
            alignItems="center"
            gap="spacing-12"
            backgroundColor="card"
            padding="spacing-12"
            borderRadius="border-radius-12"
          >
            <Box
              width={40}
              height={40}
              borderRadius="border-radius-100"
              backgroundColor="background-regular"
              justifyContent="center"
              alignItems="center"
            >
              <MaterialIcons name={icon} size={20} color={iconColor} />
            </Box>
            <Box flex={1} gap="spacing-2">
              <Box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {item.title}
                </Text>
                {item.amount ? (
                  <Text variant="bodyMedium" color="foreground-regular">
                    {formatCurrencyAndAmount(
                      item.amount,
                      item.currency || 'usd',
                      0,
                    )}
                  </Text>
                ) : null}
              </Box>
              <Box flexDirection="row" alignItems="center" gap="spacing-4">
                <Text variant="caption" color="subtext" numberOfLines={1}>
                  {item.subtitle}
                </Text>
                <Text variant="caption" color="subtext">
                  •
                </Text>
                <Text variant="caption" color="subtext">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </Text>
              </Box>
            </Box>
          </Box>
        </Touchable>
      </Link>
    </Animated.View>
  )
}

const LoadingRow = ({ index }: { index: number }) => {
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    opacity.value = withDelay(
      index * 100,
      withSpring(1, { damping: 10, stiffness: 100 }),
    )
  }, [index, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={animatedStyle}>
      <Box
        flexDirection="row"
        alignItems="center"
        gap="spacing-12"
        backgroundColor="card"
        padding="spacing-12"
        borderRadius="border-radius-12"
      >
        <Box
          width={40}
          height={40}
          borderRadius="border-radius-100"
          backgroundColor="background-regular"
        />
        <Box flex={1} gap="spacing-4">
          <Text variant="bodyMedium" loading placeholderText="Product Name" />
          <Text
            variant="caption"
            loading
            placeholderText="customer@email.com"
          />
        </Box>
      </Box>
    </Animated.View>
  )
}

export const ActivityFeed = ({
  orders,
  subscriptions,
  loading,
}: ActivityFeedProps) => {
  const activities = useMemo(() => {
    const items: ActivityItem[] = []

    orders?.forEach((order) => {
      items.push({
        id: `order-${order.id}`,
        type: 'order',
        title: order.product?.name || 'Order',
        subtitle: order.customer.email,
        amount: order.net_amount,
        currency: order.currency,
        timestamp: new Date(order.created_at),
        href: `/orders/${order.id}`,
      })
    })

    subscriptions?.forEach((subscription) => {
      items.push({
        id: `sub-${subscription.id}`,
        type: 'subscription',
        title: subscription.product?.name || 'Subscription',
        subtitle: subscription.customer.email,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        timestamp: new Date(subscription.started_at || subscription.created_at),
        href: `/subscriptions/${subscription.id}`,
      })
    })

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [orders, subscriptions])

  if (loading) {
    return (
      <Box gap="spacing-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <LoadingRow key={i} index={i} />
        ))}
      </Box>
    )
  }

  if (activities.length === 0) {
    return (
      <Box
        backgroundColor="card"
        borderRadius="border-radius-16"
        padding="spacing-24"
        alignItems="center"
        gap="spacing-8"
      >
        <MaterialIcons name="inbox" size={32} color="#666" />
        <Text variant="body" color="subtext" textAlign="center">
          No recent activity
        </Text>
      </Box>
    )
  }

  return (
    <Box gap="spacing-8">
      {activities.slice(0, 6).map((item, index) => (
        <ActivityRow key={item.id} item={item} index={index} />
      ))}
    </Box>
  )
}
