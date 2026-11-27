import { type schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { PaymentElement } from '@stripe/react-stripe-js'
import { PortalSection } from '../PortalPrimitives'
import { SavedCardsSelector } from '../SavedCardsSelector'
import { OrderPaymentCard } from './OrderPaymentCard'

type SavedCard = schemas['PaymentMethodCard'] | schemas['PaymentMethodKrCard']

export const PaymentMethodCard = ({
  savedCards,
  useNewCard,
  onUseNewCardChange,
  onSelectSavedCard,
  disabled,
}: {
  savedCards: SavedCard[]
  useNewCard: boolean
  onUseNewCardChange: (useNewCard: boolean) => void
  onSelectSavedCard: (paymentMethodId: string | null) => void
  disabled?: boolean
}) => (
  <OrderPaymentCard>
    <PortalSection
      title="Payment method"
      actions={
        !useNewCard ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onSelectSavedCard(null)
              onUseNewCardChange(true)
            }}
            disabled={disabled}
          >
            Use a different card
          </Button>
        ) : savedCards.length > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onUseNewCardChange(false)}
            disabled={disabled}
          >
            Use a saved card
          </Button>
        ) : null
      }
    >
      {useNewCard ? (
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: {
              billingDetails: {
                name: 'never',
                email: 'never',
                phone: 'never',
                address: 'never',
              },
            },
          }}
        />
      ) : (
        <SavedCardsSelector
          paymentMethods={savedCards}
          onSelectPaymentMethod={onSelectSavedCard}
          onAddNewCard={() => onUseNewCardChange(true)}
          disabled={disabled}
          showAddNewCard={false}
        />
      )}
    </PortalSection>
  </OrderPaymentCard>
)
