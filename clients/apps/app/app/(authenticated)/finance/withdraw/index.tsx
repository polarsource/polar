import { DetailRow, Details } from '@/components/Shared/Details'
import { SlideToAction } from '@/components/Shared/SlideToAction'
import { useTheme } from '@/design-system/useTheme'
import {
  useCreatePayout,
  useOrganizationAccount,
  usePayoutEstimate,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { useOrders } from '@/hooks/polar/orders'
import { useStoreReview } from '@/hooks/useStoreReview'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Stack, useRouter } from 'expo-router'
import React, { useContext, useMemo, useRef } from 'react'
import { SafeAreaView, ScrollView } from 'react-native'

export default function Index() {
  const scrollRef = useRef<ScrollView>(null)
  const { organization } = useContext(OrganizationContext)
  const { data: account } = useOrganizationAccount(organization?.id)
  const { data: estimate } = usePayoutEstimate(account?.id)
  const { data: summary } = useTransactionsSummary(account?.id)
  const { data: orders } = useOrders(organization?.id, { limit: 1 })
  const theme = useTheme()
  const router = useRouter()

  const { mutateAsync: withdrawFunds } = useCreatePayout(account?.id)
  const { requestReview, shouldShow } = useStoreReview()

  const hasOrders = useMemo(() => {
    return (orders?.pages?.[0]?.items?.length ?? 0) > 0
  }, [orders])

  return (
    <>
      <Stack.Screen options={{ title: 'Withdraw Funds' }} />
      <SafeAreaView
        style={{
          flex: 1,
          flexDirection: 'column',
          gap: theme.spacing['spacing-16'],
          justifyContent: 'space-between',
          margin: theme.spacing['spacing-16'],
        }}
      >
        <Details>
          <DetailRow
            label="Amount"
            value={formatCurrencyAndAmount(
              estimate?.gross_amount ?? 0,
              summary?.balance.currency,
            )}
          />
          <DetailRow
            label="Fees"
            value={formatCurrencyAndAmount(
              estimate?.fees_amount ?? 0,
              summary?.balance.currency,
            )}
          />
          <DetailRow
            label="Net"
            value={formatCurrencyAndAmount(
              estimate?.net_amount ?? 0,
              summary?.balance.currency,
            )}
          />
        </Details>
        <SlideToAction
          text="Slide To Withdraw"
          loadingText="Withdrawing..."
          successText="Withdrawal Complete!"
          onSlideStart={() => {
            scrollRef.current?.setNativeProps({ isEnabled: false })
          }}
          onSlideEnd={() => {
            scrollRef.current?.setNativeProps({ isEnabled: true })
          }}
          onSlideComplete={async () => {
            await withdrawFunds({ accountId: account?.id })
          }}
          onFinish={() => {
            if (shouldShow(hasOrders)) {
              setTimeout(() => {
                requestReview()
              }, 1500)
            }
            router.replace('/finance')
          }}
        />
      </SafeAreaView>
    </>
  )
}
