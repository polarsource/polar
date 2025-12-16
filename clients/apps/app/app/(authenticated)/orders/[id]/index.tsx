import { CustomerRow } from '@/components/Customers/CustomerRow'
import { Box } from '@/components/Shared/Box'
import { DetailRow, Details } from '@/components/Shared/Details'
import { Pill } from '@/components/Shared/Pill'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useOrder } from '@/hooks/polar/orders'
import { formatCurrencyAndAmount } from '@/utils/money'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView } from 'react-native'

const statusColors = {
  pending: 'yellow',
  paid: 'green',
  refunded: 'blue',
  partially_refunded: 'blue',
} as const

export default function Index() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()

  const { data: order, refetch, isRefetching } = useOrder(id as string)

  if (!order) {
    return (
      <Stack.Screen
        options={{
          title: 'Order',
        }}
      />
    )
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        flexDirection: 'column',
        gap: theme.spacing['spacing-16'],
        paddingBottom: theme.spacing['spacing-48'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: 'Order',
        }}
      />

      <Box flexDirection="row" gap="spacing-12">
        <Touchable
          style={{
            flexDirection: 'column',
            gap: theme.spacing['spacing-4'],
            borderRadius: theme.borderRadii['border-radius-12'],
            padding: theme.spacing['spacing-12'],
            backgroundColor: theme.colors.card,
            flex: 1,
            width: '50%',
          }}
          onPress={() => {
            Clipboard.setStringAsync(order.id)
          }}
          activeOpacity={0.6}
        >
          <Text variant="subtitle" color="subtext">
            #
          </Text>
          <Text
            variant="subtitle"
            style={{
              fontWeight: '500',
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
          >
            {order.id.split('-').pop()?.slice(-6, -1)}
          </Text>
        </Touchable>
        <Box
          flexDirection="column"
          gap="spacing-4"
          borderRadius="border-radius-12"
          padding="spacing-12"
          backgroundColor="card"
          flex={1}
          width="50%"
        >
          <Text color="subtext">Date</Text>
          <Text variant="bodyMedium">
            {new Date(order.created_at).toLocaleDateString('en-US', {
              dateStyle: 'medium',
            })}
          </Text>
        </Box>
      </Box>

      <CustomerRow customer={order.customer} />

      <Box>
        <Box
          padding="spacing-16"
          borderRadius="border-radius-12"
          backgroundColor="card"
        >
          {order.items.map((item, index, arr) => (
            <Box
              key={item.id}
              borderBottomWidth={index === arr.length - 1 ? 0 : 1}
              borderColor="border"
              gap="spacing-4"
              paddingVertical="spacing-16"
            >
              <Text numberOfLines={1}>{item.label}</Text>
              <Text variant="bodyMedium">
                {formatCurrencyAndAmount(item.amount)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Box>
        <Details style={{ backgroundColor: theme.colors.card }}>
          <DetailRow
            label="Status"
            value={
              <Pill
                color={statusColors[order.status]}
                textStyle={{ fontSize: 14 }}
              >
                {order.status.split('_').join(' ')}
              </Pill>
            }
            valueStyle={{ textTransform: 'capitalize' }}
          />
          <DetailRow
            label="Billing Reason"
            value={order.billing_reason.split('_').join(' ')}
            valueStyle={{ textTransform: 'capitalize' }}
          />
          <DetailRow
            label="Subtotal"
            value={formatCurrencyAndAmount(order.subtotal_amount)}
          />
          <DetailRow
            label="Discount"
            value={`-${formatCurrencyAndAmount(order.discount_amount)}`}
          />
          <DetailRow
            label="Net"
            value={formatCurrencyAndAmount(order.net_amount)}
          />
          <DetailRow
            label="Tax"
            value={formatCurrencyAndAmount(order.tax_amount)}
          />
          <DetailRow
            labelStyle={{ color: theme.colors.text }}
            label="Total"
            value={formatCurrencyAndAmount(order.total_amount)}
          />
        </Details>
      </Box>

      <Details style={{ backgroundColor: theme.colors.card }}>
        <DetailRow
          label="Address"
          value={order.customer.billing_address?.line1}
        />
        <DetailRow
          label="Address 2"
          value={order.customer.billing_address?.line2}
        />
        <DetailRow label="City" value={order.customer.billing_address?.city} />
        <DetailRow
          label="State"
          value={order.customer.billing_address?.state}
        />
        <DetailRow
          label="Postal Code"
          value={order.customer.billing_address?.postal_code}
        />
        <DetailRow
          label="Country"
          value={order.customer.billing_address?.country}
        />
      </Details>

      {order.metadata && Object.keys(order.metadata).length > 0 ? (
        <Box>
          <Details>
            {Object.entries(order.metadata).map(([key, value]) => (
              <DetailRow key={key} label={key} value={String(value)} />
            ))}
          </Details>
        </Box>
      ) : null}
    </ScrollView>
  )
}
