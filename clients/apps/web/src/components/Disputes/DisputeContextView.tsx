import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { DisputeCustomerContextCard } from './DisputeCustomerContextCard'
import { DisputeOrderContextCard } from './DisputeOrderContextCard'

export const DisputeContextView = ({
  organization,
  order,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
}) => (
  <Box flexDirection="column" rowGap="s">
    <DisputeOrderContextCard organization={organization} order={order} />
    <DisputeCustomerContextCard
      organization={organization}
      customer={order.customer}
    />
  </Box>
)
