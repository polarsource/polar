import { CheckoutLinkHeader } from '@/components/CheckoutLinks/Details/CheckoutLinkHeader'
import { LinkEmbedSection } from '@/components/CheckoutLinks/Details/LinkEmbedSection'
import { TrialPeriodCard } from '@/components/CheckoutLinks/Details/TrialPeriodCard'
import { DetailRow, Details } from '@/components/Shared/Details'
import { useTheme } from '@/design-system/useTheme'
import { useCheckoutLink } from '@/hooks/polar/checkout_links'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useContext } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

export default function CheckoutLinkDetails() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const { organization } = useContext(OrganizationContext)

  const {
    data: checkoutLink,
    refetch,
    isRefetching,
  } = useCheckoutLink(organization?.id, id as string)

  if (!checkoutLink) {
    return (
      <Stack.Screen
        options={{
          title: 'Checkout Link',
        }}
      />
    )
  }

  const productLabel =
    checkoutLink.products.length === 1
      ? checkoutLink.products[0].name
      : `${checkoutLink.products.length} Products`

  return (
    <ScrollView
      style={{
        flex: 1,
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        flexDirection: 'column',
        gap: theme.spacing['spacing-24'],
        paddingBottom: theme.spacing['spacing-48'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: checkoutLink.label || 'Untitled',
        }}
      />

      <CheckoutLinkHeader
        label={checkoutLink.label}
        productLabel={productLabel}
      />

      <LinkEmbedSection url={checkoutLink.url} />

      <Details>
        <DetailRow
          label="Products"
          value={checkoutLink.products.map((p) => p.name).join(', ')}
        />
        <DetailRow label="Success URL" value={checkoutLink.success_url} />
        <DetailRow label="Discount" value={checkoutLink.discount?.name} />
        <DetailRow
          label="Discount codes"
          value={checkoutLink.allow_discount_codes ? 'Allowed' : 'Not allowed'}
        />
        <DetailRow
          label="Billing address"
          value={checkoutLink.require_billing_address ? 'Required' : 'Optional'}
        />
      </Details>

      {checkoutLink.trial_interval ? (
        <TrialPeriodCard
          interval={checkoutLink.trial_interval}
          intervalCount={checkoutLink.trial_interval_count ?? 0}
        />
      ) : null}

      {Object.keys(checkoutLink.metadata).length > 0 ? (
        <Details>
          {Object.entries(checkoutLink.metadata).map(([key, value]) => (
            <DetailRow key={key} label={key} value={String(value)} />
          ))}
        </Details>
      ) : null}
    </ScrollView>
  )
}
