import { copyable } from '@/components/Shared/ClickToCopy'
import { ContextCard } from '@/components/Shared/ContextCard'
import { DetailRow } from '@/components/Shared/DetailRow'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'

export const DisputeCustomerContextCard = ({
  organization,
  customer,
}: {
  organization: schemas['Organization']
  customer: schemas['OrderCustomer']
}) => (
  <ContextCard>
    <Text variant="heading-xxs" as="h3">
      Customer
    </Text>
    <Box flexDirection="column">
      <DetailRow label="Name" value={copyable(customer.name)} />
      <DetailRow label="Email" value={copyable(customer.email)} />
      <DetailRow
        label="ID"
        value={copyable(customer.id)}
        valueClassName="font-mono text-xs"
      />
      {customer.external_id ? (
        <DetailRow
          label="External ID"
          value={copyable(customer.external_id)}
          valueClassName="min-w-0 break-all"
        />
      ) : null}
      <DetailRow
        label="Created At"
        value={<FormattedDateTime datetime={customer.created_at} />}
      />
    </Box>
    <Button className="w-full" size="default" variant="secondary" asChild>
      <Link href={buildCustomerDashboardPath(organization.slug, customer)}>
        View Customer
      </Link>
    </Button>
  </ContextCard>
)
