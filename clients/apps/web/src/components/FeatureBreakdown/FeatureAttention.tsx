import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { economics, FeatureDetailCustomer } from './featureEconomics'

const TOP = 5

export interface Finding {
  id: string
  title: string
  customers: Set<FeatureDetailCustomer>
}

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
}

export const featureFindings = (
  customers: FeatureDetailCustomer[],
): Finding[] => {
  const rows = customers.map((customer) => ({
    customer,
    ...economics(customer),
  }))
  const paying = rows.filter((row) => row.customer.plan !== null)
  const free = rows.filter((row) => row.customer.plan === null)
  const findings: Finding[] = []
  const set = (subset: typeof rows) =>
    new Set(subset.map((row) => row.customer))

  const losing = paying.filter((row) => row.cost > row.revenue)
  if (losing.length > 0) {
    findings.push({
      id: 'unprofitable',
      title: 'Unprofitable',
      customers: set(losing),
    })
  }

  const typical = median(paying.map((row) => row.customer.occurrences))
  const outgrowing = free.filter((row) => row.customer.occurrences > typical)
  if (outgrowing.length > 0) {
    findings.push({
      id: 'upsell',
      title: 'Upsell',
      customers: set(outgrowing),
    })
  }

  if (free.length > 0) {
    findings.push({
      id: 'free',
      title: 'Free',
      customers: set(free),
    })
  }

  if (rows.length > TOP) {
    const top = rows.toSorted((a, b) => b.cost - a.cost).slice(0, TOP)
    findings.push({
      id: 'top',
      title: `Top ${TOP} by cost`,
      customers: set(top),
    })
  }
  return findings
}

const Chip = ({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean
  label: string
  value: string
  onClick: () => void
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className="cursor-pointer rounded-full"
  >
    <Box
      alignItems="center"
      gap="s"
      height={28}
      paddingHorizontal="m"
      borderRadius="full"
      backgroundColor={{
        base: active ? 'background-inverse' : 'background-card',
        hover: active ? 'background-inverse' : 'background-card',
      }}
      opacity={{ base: 1, hover: active ? 1 : 0.8 }}
      transitionProperty="common"
      transitionDuration="fast"
    >
      <Text color={active ? 'inverse' : undefined}>{label}</Text>
      <Text color={active ? 'inverse' : 'muted'} tabularNums>
        {value}
      </Text>
    </Box>
  </button>
)

// Findings act as filters: picking one narrows the customer table and the
// scatter to the customers behind it.
export const FeatureFilters = ({
  findings,
  total,
  selected,
  onSelect,
}: {
  findings: Finding[]
  total: number
  selected: string | null
  onSelect: (id: string | null) => void
}) => (
  <Box gap="s" flexWrap="wrap">
    <Chip
      active={selected === null}
      label="All"
      value={total.toLocaleString('en-US')}
      onClick={() => onSelect(null)}
    />
    {findings.map((finding) => (
      <Chip
        key={finding.id}
        active={finding.id === selected}
        label={finding.title}
        value={finding.customers.size.toLocaleString('en-US')}
        onClick={() => onSelect(finding.id === selected ? null : finding.id)}
      />
    ))}
  </Box>
)
