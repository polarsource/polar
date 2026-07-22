import { formatTrialEnd, type TrialChangeOutcome } from '@/utils/trial-change'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'

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

  return (
    <Box
      padding="m"
      borderRadius="m"
      backgroundColor="background-warning"
      flexDirection="column"
      rowGap="s"
    >
      {trialOutcome?.kind === 'ends' && (
        <p className="text-sm text-yellow-700">
          This change will end the current trial and{' '}
          <strong className="font-medium">
            charge the customer immediately
          </strong>{' '}
          for the first billing period of{' '}
          <strong className="font-medium">{selectedProduct.name}</strong>.
        </p>
      )}
      {trialOutcome?.kind === 'continues' && (
        <p className="text-sm text-yellow-700">
          The trial will continue until{' '}
          <strong className="font-medium">
            {formatTrialEnd(trialOutcome.trialEnd)}
          </strong>
          . The customer won&apos;t be charged before then.
        </p>
      )}
      <p className="text-sm text-yellow-700">
        By updating this subscription, the customer will get access to{' '}
        <strong className="font-medium">{selectedProduct.name}</strong>{' '}
        benefits, and lose access to{' '}
        <strong className="font-medium">{subscription.product.name}</strong>{' '}
        benefits.
      </p>
    </Box>
  )
}
