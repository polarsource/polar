import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { twMerge } from 'tailwind-merge'

const formatPrice = formatCurrency('standard', 'en-US')

const formatFee = (fee: schemas['OrganizationPlanFee']) =>
  `${(fee.percent / 100).toFixed(2)}% + $${(fee.fixed / 100).toFixed(2)}`

export const PlanCard = ({
  plan,
  isCurrent,
  isLocked,
  isSelected,
  onSelect,
}: {
  plan: schemas['OrganizationPlan']
  isCurrent: boolean
  isLocked: boolean
  isSelected: boolean
  onSelect: () => void
}) => {
  const amount = plan.price?.amount ?? 0
  const currency = plan.price?.currency ?? 'usd'
  const disabled = isCurrent || isLocked
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={twMerge(
        'dark:border-polar-700 block h-full w-full rounded-2xl border bg-white text-left transition-colors dark:bg-transparent',
        disabled
          ? 'dark:bg-polar-800 cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
          : isSelected
            ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20'
            : 'dark:hover:border-polar-600 cursor-pointer hover:border-gray-300',
      )}
    >
      <Box
        display="flex"
        flexDirection="column"
        rowGap="2xl"
        height="100%"
        padding="2xl"
      >
        <Box display="flex" flexDirection="column" rowGap="s">
          <Box display="flex" alignItems="center" columnGap="s">
            <Text variant="heading-xs" as="h3">
              {plan.name}
            </Text>
            {isCurrent && <Pill color="gray">Current</Pill>}
            {plan.highlight && !isCurrent && <Pill color="blue">Popular</Pill>}
          </Box>
          {plan.description && <Text color="muted">{plan.description}</Text>}
        </Box>

        <Box display="flex" flexDirection="column" rowGap="s">
          <Box display="flex" alignItems="baseline" columnGap="m">
            <Text variant="heading-s" as="span">
              {amount === 0 ? 'Free' : formatPrice(amount, currency)}
            </Text>
            {amount > 0 && plan.recurring_interval && (
              <Text color="muted" as="span">
                / {plan.recurring_interval}
              </Text>
            )}
          </Box>
          {plan.transaction_fee && (
            <Text color="muted">
              {formatFee(plan.transaction_fee)} per transaction
            </Text>
          )}
        </Box>

        {(plan.features?.length ?? 0) > 0 && (
          <Box
            as="ul"
            display="flex"
            flexDirection="column"
            rowGap="s"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            paddingTop="2xl"
          >
            {plan.features?.map((feature) => (
              <Box
                as="li"
                key={feature}
                display="flex"
                alignItems="start"
                columnGap="s"
              >
                <CheckOutlined
                  className="mt-0.5 text-blue-500"
                  fontSize="inherit"
                />
                <Text as="span">{feature}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </button>
  )
}
