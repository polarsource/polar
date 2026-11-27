import { formatCountry } from '@/utils/formatters'
import { type schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FIXED_STATE_OPTIONS } from '@polar-sh/ui/lib/states'
import { BillingDetailsFields } from '../BillingDetailsFields'
import { PortalSection, PortalText } from '../PortalPrimitives'
import { ReactivationCard } from './ReactivationCard'

const formatState = (country: string, state: string) =>
  FIXED_STATE_OPTIONS[country]?.[state] ?? state.replace(`${country}-`, '')

const getBillingDetailsLines = (
  order: schemas['CustomerOrder'],
  customer: schemas['CustomerPortalCustomer'],
) => {
  const address = order.billing_address
  const name = order.billing_name || customer.name
  if (!address) {
    return name ? [name] : []
  }
  return [
    name,
    address.line1,
    address.line2,
    [address.postal_code, address.city].filter(Boolean).join(' '),
    [
      address.state ? formatState(address.country, address.state) : null,
      formatCountry(address.country),
    ]
      .filter(Boolean)
      .join(', '),
    order.tax_id ? order.tax_id[0] : null,
  ].filter((line): line is string => !!line)
}

export const BillingDetailsCard = ({
  order,
  customer,
  editing,
  onEdit,
  onCancel,
  disabled,
}: {
  order: schemas['CustomerOrder']
  customer: schemas['CustomerPortalCustomer']
  editing: boolean
  onEdit: () => void
  onCancel?: () => void
  disabled?: boolean
}) => (
  <ReactivationCard>
    <PortalSection
      title="Billing details"
      actions={
        editing ? (
          onCancel ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={disabled}
            >
              Cancel
            </Button>
          ) : null
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            disabled={disabled}
          >
            Edit billing details
          </Button>
        )
      }
    >
      {editing ? (
        <BillingDetailsFields customer={customer} />
      ) : (
        <Box flexDirection="column" rowGap="xs">
          {getBillingDetailsLines(order, customer).map((line) => (
            <PortalText key={line} block className="text-sm">
              {line}
            </PortalText>
          ))}
        </Box>
      )}
    </PortalSection>
  </ReactivationCard>
)
