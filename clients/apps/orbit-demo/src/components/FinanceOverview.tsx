import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FINANCE,
  formatMoney,
  TYPE_LABEL,
  type Transaction,
} from '@/data/finance'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

export const FinanceOverview = () => (
  <Box display="flex" flexDirection="column" rowGap="3xl" paddingTop="m">
    <BalanceHeader />
    <StatsRow />
    <TransactionsSection transactions={FINANCE.transactions} />
  </Box>
)

const BalanceHeader = () => (
  <Box
    display="flex"
    alignItems={{ md: 'end' }}
    justifyContent={{ md: 'between' }}
    flexDirection={{ base: 'column', md: 'row' }}
    rowGap="l"
    columnGap="xl"
  >
    <Box display="flex" flexDirection="column" rowGap="s">
      <Text variant="default" color="muted">
        Available Balance
      </Text>
      <Text variant="heading-l" as="h1" color="default">
        {formatMoney(FINANCE.availableCents)}
      </Text>
    </Box>
    <PayoutButton />
  </Box>
)

const PayoutButton = () => (
  <Box
    display="inline-flex"
    alignItems="center"
    columnGap="s"
    paddingHorizontal="xl"
    paddingVertical="m"
    backgroundColor="background-inverse"
    color="text-inverse"
    borderRadius="full"
    cursor="pointer"
    role="button"
    aria-label="Withdraw funds"
  >
    <Text variant="body" color="inherit">
      Withdraw
    </Text>
  </Box>
)

type StatProps = { label: string; value: string; sub?: string }

const Stat = ({ label, value, sub }: StatProps) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="heading-xs" color="default">
      {value}
    </Text>
    {sub && (
      <Text variant="default" color="muted">
        {sub}
      </Text>
    )}
  </Box>
)

const StatsRow = () => (
  <Box
    display="grid"
    gridTemplateColumns={{
      base: 'repeat(2, 1fr)',
      md: 'repeat(4, 1fr)',
    }}
    columnGap="xl"
    rowGap="xl"
    paddingVertical="xl"
    borderTopWidth={1}
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Stat label="Pending" value={formatMoney(FINANCE.pendingCents)} />
    <Stat
      label="Lifetime Revenue"
      value={formatMoney(FINANCE.lifetimeRevenueCents)}
    />
    <Stat
      label="Lifetime Fees"
      value={formatMoney(FINANCE.lifetimeFeesCents)}
    />
    <Stat
      label="Next Payout"
      value={
        FINANCE.nextPayout ? formatMoney(FINANCE.nextPayout.amountCents) : '—'
      }
      sub={FINANCE.nextPayout ? formatDate(FINANCE.nextPayout.date) : undefined}
    />
  </Box>
)

const TX_GRID = '120px minmax(0, 2fr) 120px 100px 120px'

const TransactionsSection = ({
  transactions,
}: {
  transactions: Transaction[]
}) => (
  <Box display="flex" flexDirection="column" rowGap="l">
    <Box display="flex" alignItems="baseline" columnGap="l">
      <Text variant="heading-xs" as="h2" color="default">
        Transactions
      </Text>
      <Text variant="heading-xs" color="muted">
        {transactions.length}
      </Text>
    </Box>
    <Box display="flex" flexDirection="column">
      <ColumnHeader />
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} />
      ))}
      {transactions.length === 0 && (
        <Box paddingVertical="xl">
          <Text variant="body" color="muted">
            No transactions yet.
          </Text>
        </Box>
      )}
    </Box>
  </Box>
)

const ColumnHeader = () => (
  <Box
    display="grid"
    gridTemplateColumns={TX_GRID}
    alignItems="center"
    columnGap="l"
    paddingVertical="m"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="default" color="muted">
      Date
    </Text>
    <Text variant="default" color="muted">
      Description
    </Text>
    <Text variant="default" color="muted" align="right">
      Gross
    </Text>
    <Text variant="default" color="muted" align="right">
      Fee
    </Text>
    <Text variant="default" color="muted" align="right">
      Net
    </Text>
  </Box>
)

const TransactionRow = ({ tx }: { tx: Transaction }) => (
  <Box
    display="grid"
    gridTemplateColumns={TX_GRID}
    alignItems="center"
    columnGap="l"
    paddingVertical="m"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="body" color="muted">
      {formatDate(tx.date)}
    </Text>
    <Box display="flex" flexDirection="column" rowGap="xs">
      <Text variant="body" color="default">
        {tx.description}
      </Text>
      <Text variant="default" color="muted">
        {TYPE_LABEL[tx.type]}
      </Text>
    </Box>
    <Text variant="body" color="default" align="right">
      {formatMoney(tx.grossCents)}
    </Text>
    <Text variant="body" color="muted" align="right">
      {tx.feeCents === 0 ? '—' : formatMoney(tx.feeCents)}
    </Text>
    <Text variant="body" color="default" align="right">
      {formatMoney(tx.netCents)}
    </Text>
  </Box>
)
