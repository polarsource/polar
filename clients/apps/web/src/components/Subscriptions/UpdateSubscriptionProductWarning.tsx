import { formatTrialEnd, type TrialChangeOutcome } from '@/utils/trial-change'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'

export const UpdateSubscriptionProductWarning = ({
  subscription,
  selectedProduct,
  trialOutcome,
}: {
  subscription: schemas['Subscription']
  selectedProduct: schemas['Product']
  trialOutcome: TrialChangeOutcome
}) => {
  if (selectedProduct.id === subscription.product.id) {
    return null
  }

  const title =
    trialOutcome?.kind === 'ends'
      ? 'Trial ends & customer charged immediately'
      : trialOutcome?.kind === 'continues'
        ? 'Trial continues'
        : 'Product change'

  return (
    <Alert
      variant="warning"
      title={title}
      description={
        <>
          {trialOutcome?.kind === 'ends' && (
            <>
              This change will end the current trial and{' '}
              <strong>charge the customer immediately</strong> for the first
              billing period of <strong>{selectedProduct.name}</strong>.{' '}
            </>
          )}
          {trialOutcome?.kind === 'continues' && (
            <>
              The trial will continue until{' '}
              <strong>{formatTrialEnd(trialOutcome.trialEnd)}</strong>. The
              customer won&apos;t be charged before then.{' '}
            </>
          )}
          By updating this subscription, the customer will get access to{' '}
          <strong>{selectedProduct.name}</strong> benefits, and lose access to{' '}
          <strong>{subscription.product.name}</strong> benefits.
        </>
      }
    />
  )
}
