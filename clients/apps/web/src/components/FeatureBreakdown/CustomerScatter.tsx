import { EconomicsScatter } from './EconomicsScatter'
import {
  customerKey,
  economics,
  FeatureDetailCustomer,
} from './featureEconomics'

// Each customer's cost to serve against the revenue they bring in.
export const CustomerScatter = ({
  customers,
  currency,
  focus,
  hovered,
  onHover,
  onSelect,
}: {
  customers: FeatureDetailCustomer[]
  currency: string
  focus: Set<FeatureDetailCustomer> | null
  hovered: string | null
  onHover: (key: string | null) => void
  onSelect: (key: string) => void
}) => (
  <EconomicsScatter
    points={customers.map((customer) => ({
      key: customerKey(customer),
      label: customer.name ?? customer.email ?? 'Unknown',
      ...economics(customer),
    }))}
    currency={currency}
    focus={focus ? new Set([...focus].map(customerKey)) : null}
    hovered={hovered}
    onHover={onHover}
    onSelect={onSelect}
  />
)
