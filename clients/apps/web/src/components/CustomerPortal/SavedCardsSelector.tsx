'use client'

import type { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import CreditCardBrandIcon from '../CreditCardBrandIcon'

type PaymentMethodType = schemas['PaymentMethodCard']

interface SavedCardsSelectorProps {
  paymentMethods: PaymentMethodType[]
  onSelectPaymentMethod: (paymentMethodId: string) => void
  onAddNewCard: () => void
  disabled?: boolean
}

export const SavedCardsSelector = ({
  paymentMethods,
  onSelectPaymentMethod,
  onAddNewCard,
  disabled = false,
}: SavedCardsSelectorProps) => {
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null)

  const handleCardSelect = (paymentMethodId: string) => {
    setSelectedMethodId(paymentMethodId)
    onSelectPaymentMethod(paymentMethodId)
  }

  const handleAddNewCard = () => {
    setSelectedMethodId(null)
    onAddNewCard()
  }

  if (paymentMethods.length === 0) {
    return (
      <Box flexDirection="column" rowGap="l">
        <Text color="muted">No saved payment methods found.</Text>
        <Button onClick={handleAddNewCard} disabled={disabled} fullWidth>
          Add new card
        </Button>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="s">
        <Text variant="title">Saved payment methods</Text>
        <Box flexDirection="column" rowGap="s">
          {paymentMethods.map((paymentMethod) => {
            const { brand, last4, exp_year, exp_month } =
              paymentMethod.method_metadata
            const isSelected = selectedMethodId === paymentMethod.id

            return (
              <Button
                key={paymentMethod.id}
                variant={isSelected ? 'default' : 'secondary'}
                onClick={() => handleCardSelect(paymentMethod.id)}
                disabled={disabled}
                fullWidth
              >
                <Box alignItems="center" columnGap="m" width="100%">
                  <CreditCardBrandIcon width="2.5em" brand={brand} />
                  <Box flexDirection="column" alignItems="start" flexGrow={1}>
                    <Text
                      as="span"
                      variant="title"
                      color={isSelected ? 'inverse' : 'default'}
                    >
                      {brand.charAt(0).toUpperCase() + brand.slice(1)} ••••{' '}
                      {last4}
                    </Text>
                    <Text
                      as="span"
                      variant="caption"
                      color={isSelected ? 'inverse' : 'muted'}
                    >
                      Expires {exp_month.toString().padStart(2, '0')}/{exp_year}
                    </Text>
                  </Box>
                </Box>
              </Button>
            )
          })}
        </Box>
      </Box>

      <Box
        paddingTop="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Button
          onClick={handleAddNewCard}
          disabled={disabled}
          variant="secondary"
          fullWidth
        >
          Use a different card
        </Button>
      </Box>
    </Box>
  )
}
