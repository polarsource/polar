import CheckIcon from '@/components/Icons/CheckIcon'
import DollarSignIcon from '@/components/Icons/DollarSignIcon'
import EyeIcon from '@/components/Icons/EyeIcon'
import Icon from '@/components/Icons/Icon'
import {
  PledgeState,
  PledgeType,
  Reward,
  RewardState,
} from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'

export type Column = 'ESTIMATED_PAYOUT_DATE' | 'PAID_OUT_DATE' | 'RECEIVER'

const List = (props: {
  rewards: Reward[]
  columns: Column[]
  title: string
  subtitle: string
}) => {
  const { rewards, columns, title, subtitle } = props

  const icon = (reward: Reward) => {
    if (reward.state === RewardState.PENDING) {
      return <Icon classes="bg-gray-200 text-gray-600" icon={<EyeIcon />} />
    }
    if (reward.state === RewardState.PAID) {
      return <Icon classes="bg-green-200 text-green-600" icon={<CheckIcon />} />
    }
    return (
      <Icon classes="bg-blue-200 text-blue-600" icon={<DollarSignIcon />} />
    )
  }

  const issueLink = (reward: Reward): string => {
    return `https://github.com/${reward.pledge.issue.repository.organization.name}/${reward.pledge.issue.repository.name}/issues/${reward.pledge.issue?.number}`
  }

  const showEstimatedPayoutDate = columns.some(
    (c) => c === 'ESTIMATED_PAYOUT_DATE',
  )

  const showPaidOutDate = columns.some((c) => c === 'PAID_OUT_DATE')

  const showReceiver = columns.some((c) => c === 'RECEIVER')

  return (
    <div>
      <h2 className="px-2 font-medium text-gray-900 dark:text-gray-200">
        {title}
      </h2>
      <table className="w-full text-left">
        <thead className="text-gray-900 dark:text-gray-500">
          <tr>
            <th
              scope="col"
              className="relative isolate  whitespace-nowrap px-2  py-3.5 text-left text-sm font-medium "
            >
              {subtitle}
            </th>

            {showReceiver && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-semibold"
              >
                Receiver
              </th>
            )}

            <th
              scope="col"
              className="relative isolate hidden whitespace-nowrap py-3.5 pr-2 text-left text-sm font-medium md:table-cell"
            >
              Pledge Date
            </th>

            {showEstimatedPayoutDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-medium"
              >
                Est. payout date
              </th>
            )}
            {showPaidOutDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-medium"
              >
                Paid out date
              </th>
            )}

            <th
              scope="col"
              className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-right text-sm font-semibold"
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {rewards &&
            rewards.map((t) => (
              <tr key={t.pledge.id}>
                <td className="px-2 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    {icon(t)}
                    <span className="inline-flex flex-col">
                      <a
                        href={issueLink(t)}
                        className="text-blue-600 dark:text-blue-500"
                      >
                        {t.pledge.issue.repository.organization.name}/
                        {t.pledge.issue.repository.name}#{t.pledge.issue.number}
                      </a>
                      {t.pledge.issue.title}
                    </span>
                  </div>
                </td>

                {showReceiver && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1 ">
                      {t.user?.avatar_url && (
                        <img
                          src={t.user?.avatar_url}
                          className="h-6 w-6 rounded-full"
                        />
                      )}
                      <a
                        href={`https://github.com/${t.user?.username}`}
                        className="text-blue-500"
                      >
                        @{t.user?.username || 'Unknown'}
                      </a>
                    </div>
                  </td>
                )}

                <td className="hidden whitespace-nowrap py-3 pr-3 text-sm text-gray-500 md:table-cell">
                  {formatDate(t.pledge.created_at)}
                </td>

                {showEstimatedPayoutDate && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        {(t.pledge.scheduled_payout_at &&
                          formatDate(t.pledge.scheduled_payout_at)) ||
                          'Unknown'}
                      </div>

                      {t.pledge.type === PledgeType.PAY_ON_COMPLETION &&
                        t.pledge.state === PledgeState.CREATED && (
                          <div className="w-fit whitespace-nowrap rounded-full bg-blue-200 px-2 py-0.5 text-blue-700 dark:bg-blue-800 dark:text-blue-200">
                            Pending payment from pledger
                          </div>
                        )}

                      {t.pledge.type === PledgeType.PAY_ON_COMPLETION &&
                        t.pledge.state === PledgeState.PENDING && (
                          <div className="w-fit whitespace-nowrap rounded-full bg-green-200 px-2 py-0.5 text-green-700 dark:bg-green-800 dark:text-green-200">
                            Pledger paid invoice
                          </div>
                        )}
                    </div>
                  </td>
                )}

                {showPaidOutDate && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500 ">
                    {(t.paid_at && formatDate(t.paid_at)) || 'Unknown'}
                  </td>
                )}

                <td className="whitespace-nowrap py-3 pr-3 text-right text-sm text-gray-500">
                  ${getCentsInDollarString(t.amount.amount, true, true)}
                  <br />
                  <span className="text-gray-400">
                    (of $
                    {getCentsInDollarString(t.pledge.amount.amount, true, true)}
                    )
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default List

const formatDate = (str: string): string => {
  const d = new Date(str)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
