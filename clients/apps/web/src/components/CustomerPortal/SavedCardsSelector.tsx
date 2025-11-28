'use client'

import type { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
      <div className="space-y-4">
        <p className="text-sm text-gray-500">No saved payment methods found.</p>
        <Button
          onClick={handleAddNewCard}
          disabled={disabled}
          className="w-full"
        >
          Add New Card
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium">Saved Payment Methods</h4>
        <div className="space-y-2">
          {paymentMethods.map((paymentMethod) => {
            const { brand, last4, exp_year, exp_month } =
              paymentMethod.method_metadata
            const isSelected = selectedMethodId === paymentMethod.id

            return (
              <button
                key={paymentMethod.id}
                onClick={() => handleCardSelect(paymentMethod.id)}
                disabled={disabled}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'dark:border-polar-700 dark:hover:bg-polar-800 border-gray-200 hover:bg-gray-50'
                } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
              >
                <div className="flex items-center gap-3">
                  <CreditCardBrandIcon
                    width="2.5em"
                    brand={brand}
                    className="dark:border-polar-700 shrink-0 rounded-sm border border-gray-200 p-1"
                  />
                  <div className="grow">
                    <div className="font-medium capitalize">
                      {brand} •••• {last4}
                    </div>
                    <div className="dark:text-polar-500 text-sm text-gray-500">
                      Expires {exp_month.toString().padStart(2, '0')}/{exp_year}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="shrink-0">
                      <div className="bg-blue flex h-4 w-4 items-center justify-center rounded-full">
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t pt-4">
        <Button
          onClick={handleAddNewCard}
          disabled={disabled}
          variant="outline"
          className="w-full"
        >
          Use a Different Card
        </Button>
      </div>
    </div>
  )
}
