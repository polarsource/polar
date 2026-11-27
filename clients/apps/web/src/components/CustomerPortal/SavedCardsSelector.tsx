'use client'

import type { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import CreditCardBrandIcon from '../CreditCardBrandIcon'
import {
  getPaymentMethodCardInfo,
  getPaymentMethodTypeLabel,
} from '../PaymentMethodDisplay'
import { PortalCardList, PortalListItem, PortalText } from './PortalPrimitives'

type PaymentMethodType =
  | schemas['PaymentMethodCard']
  | schemas['PaymentMethodKrCard']

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
        <PortalText tone="secondary" className="text-sm">
          No saved payment methods found.
        </PortalText>
        <Box justifyContent="end">
          <Button onClick={handleAddNewCard} disabled={disabled}>
            Add new card
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <PortalText tone="secondary" className="text-sm">
        Choose a saved card to pay with
      </PortalText>
      <PortalCardList>
        {paymentMethods.map((paymentMethod) => {
          const card = getPaymentMethodCardInfo(paymentMethod)
          const isSelected = selectedMethodId === paymentMethod.id
          const label = card?.brand
            ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
            : getPaymentMethodTypeLabel(paymentMethod.type)

          return (
            <PortalListItem
              key={paymentMethod.id}
              onClick={
                disabled ? undefined : () => handleCardSelect(paymentMethod.id)
              }
              title={
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  columnGap="m"
                >
                  <CreditCardBrandIcon
                    width="2.5em"
                    brand={card?.brand ?? 'unknown'}
                    className="dark:border-polar-700 shrink-0 rounded-sm border border-gray-200"
                  />
                  {`${label}${card?.last4 ? ` •••• ${card.last4}` : ''}`}
                </Box>
              }
              meta={
                card?.exp_month !== undefined &&
                card?.exp_year !== undefined ? (
                  <PortalText tone="secondary" className="text-sm">
                    {isSelected
                      ? 'Selected'
                      : `Expires ${card.exp_month.toString().padStart(2, '0')}/${card.exp_year}`}
                  </PortalText>
                ) : undefined
              }
            />
          )
        })}
      </PortalCardList>
      <Box justifyContent="end">
        <Button
          onClick={handleAddNewCard}
          disabled={disabled}
          variant="secondary"
        >
          Use a different card
        </Button>
      </Box>
    </Box>
  )
}
