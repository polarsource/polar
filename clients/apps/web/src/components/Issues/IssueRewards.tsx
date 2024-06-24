import { Reward, RewardState } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/lib/money'
import { twMerge } from 'tailwind-merge'

const IssueRewards = ({ rewards }: { rewards: Reward[] }) => {
  const paidOutSum = rewards
    .filter((r) => r.state === RewardState.PAID)
    .map((r) => r.amount.amount)
    .reduce((a, b) => a + b, 0)

  const isAtRisk = (r: Reward) => {
    if (r.pledge.refunded_at) {
      return true
    }
    return false
  }

  const pendingSum = rewards
    .filter((r) => r.state === RewardState.PENDING && !isAtRisk(r))
    .map((r) => r.amount.amount)
    .reduce((a, b) => a + b, 0)

  const atRiskOrRefundedSum = rewards
    .filter((r) => r.state === RewardState.PENDING && isAtRisk(r))
    .map((r) => r.amount.amount)
    .reduce((a, b) => a + b, 0)

  return (
    <div
      className={`dark:divide-polar-700 flex divide-x divide-gray-100 border-t py-2 text-sm`}
    >
      {paidOutSum > 0 && (
        <Group>
          <Pill className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-300">
            ${getCentsInDollarString(paidOutSum, false, true)}
          </Pill>
          <span>Paid out</span>
        </Group>
      )}

      {pendingSum > 0 && (
        <Group>
          <Pill className="dark:bg-polar-900 dark:text-polar-300 bg-gray-100 text-gray-800">
            ${getCentsInDollarString(pendingSum, false, true)}
          </Pill>
          <span>Pending</span>
        </Group>
      )}

      {atRiskOrRefundedSum > 0 && (
        <Group>
          <Pill className="bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-300">
            ${getCentsInDollarString(atRiskOrRefundedSum, false, true)}
          </Pill>
          <span>At risk or refunded</span>
        </Group>
      )}
    </div>
  )
}

export default IssueRewards

const Group = (props: { children: React.ReactNode }) => (
  <div
    className={`dark:text-polar-400 flex justify-between px-6 text-sm text-gray-700`}
  >
    <div className="flex w-full items-center justify-between gap-2">
      {props.children}
    </div>
  </div>
)

const Pill = ({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) => (
  <div className={twMerge('rounded-full px-2 py-0.5', className)}>
    {children}
  </div>
)
