'use client'

import { toast } from '@/components/Toast/use-toast'
import { useApproveAgentSetupDrafts } from '@/hooks/queries/agentSetupRuns'
import { schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

const INTERVAL_LABELS: Record<schemas['RecurringInterval'], string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
}

const toCents = (price: string) => {
  const amount = Number(price)
  return price.trim() !== '' && Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : null
}

interface Props {
  organization: schemas['Organization']
  drafts: schemas['AgentSetupDrafts']
}

export const PlansReview = ({ organization, drafts }: Props) => {
  const products = drafts.products ?? []
  const approve = useApproveAgentSetupDrafts(organization.id)
  const [prices, setPrices] = useState(() =>
    products.map((product) => (product.price_amount / 100).toString()),
  )
  const [error, setError] = useState<string | null>(null)

  const setPrice = (index: number, price: string) => {
    setError(null)
    setPrices((current) =>
      current.map((value, position) => (position === index ? price : value)),
    )
  }

  const onApprove = async () => {
    const amounts = prices.map(toCents)
    if (amounts.some((amount) => amount === null)) {
      setError('Enter a price of 0 or more for every plan.')
      return
    }
    try {
      await approve.mutateAsync({
        ...drafts,
        products: products.map((product, index) => ({
          ...product,
          price_amount: amounts[index] ?? product.price_amount,
        })),
      })
    } catch {
      toast({
        title: 'Could not approve the plans',
        description: 'Try again in a moment.',
      })
    }
  }

  return (
    <Box flexDirection="column" rowGap="m">
      <Text variant="caption" color="muted">
        Your agent found these in your app. Set the prices you want. It creates
        the products once you approve.
      </Text>
      {products.map((product, index) => (
        <Box
          key={`${product.name}-${index}`}
          alignItems="center"
          justifyContent="between"
          columnGap="m"
        >
          <Box flexDirection="column" rowGap="none">
            <Text variant="label">{product.name}</Text>
            <Text variant="caption" color="muted">
              {product.recurring_interval
                ? INTERVAL_LABELS[product.recurring_interval]
                : 'One-time'}
              {product.description ? ` · ${product.description}` : ''}
            </Text>
          </Box>
          <Box display="block" width={140} flexShrink={0}>
            <Input
              type="number"
              min={0}
              step="0.01"
              aria-label={`Price for ${product.name}`}
              value={prices[index] ?? ''}
              onChange={(event) => setPrice(index, event.target.value)}
              postSlot={
                <Text variant="caption" color="muted">
                  {organization.default_presentment_currency.toUpperCase()}
                </Text>
              }
            />
          </Box>
        </Box>
      ))}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
      <Box justifyContent="end">
        <Button size="sm" onClick={onApprove} loading={approve.isPending}>
          Approve plans
        </Button>
      </Box>
    </Box>
  )
}
