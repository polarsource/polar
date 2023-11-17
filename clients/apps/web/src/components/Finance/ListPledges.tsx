import DollarSignIcon from '@/components/Icons/DollarSignIcon'
import EyeIcon from '@/components/Icons/EyeIcon'
import Icon from '@/components/Icons/Icon'
import RefundIcon from '@/components/Icons/RefundIcon'
import { githubIssueLink } from '@/utils/github'
import { Pledge, PledgeState, PledgeType } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import { dateOrString } from 'polarkit/utils'

export type Column = 'ESTIMATED_PAYOUT_DATE' | 'REFUNDED_DATE'

const List = (props: {
  pledges: Pledge[]
  columns: Column[]
  title: string
  subtitle: string
}) => {
  const { pledges, columns, title, subtitle } = props

  const icon = (pledge: Pledge) => {
    if (
      pledge.issue.needs_confirmation_solved ||
      pledge.state === PledgeState.PENDING ||
      pledge.state === PledgeState.DISPUTED
    ) {
      return <Icon classes="bg-gray-200 text-gray-600" icon={<EyeIcon />} />
    }
    if (
      pledge.state === PledgeState.REFUNDED ||
      pledge.state === PledgeState.CHARGE_DISPUTED
    ) {
      return <Icon classes="bg-red-200 text-red-600" icon={<RefundIcon />} />
    }

    return (
      <Icon classes="bg-blue-200 text-blue-500" icon={<DollarSignIcon />} />
    )
  }

  const showEstimatedPayoutDate = columns.some(
    (c) => c === 'ESTIMATED_PAYOUT_DATE',
  )

  const showRefundedDate = columns.some((c) => c === 'REFUNDED_DATE')

  return (
    <div>
      <h2 className="dark:text-polar-200 px-2 font-medium text-gray-900">
        {title}
      </h2>
      <table className="w-full text-left">
        <thead className="dark:text-polar-400 text-gray-900">
          <tr>
            <th
              scope="col"
              className="relative isolate  whitespace-nowrap px-2  py-3.5 text-left text-sm font-medium "
            >
              {subtitle}
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-medium "
            >
              Backer
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-medium"
            >
              Date
            </th>
            {showEstimatedPayoutDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-medium"
              >
                Est. payout date
              </th>
            )}
            {showRefundedDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-semibold"
              >
                Refunded date
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
        <tbody className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-t border-gray-200">
          {pledges &&
            pledges.map((t) => (
              <tr key={t.id}>
                <td className="dark:text-polar-400 px-2 py-3 text-sm text-gray-500 ">
                  <div className="flex items-center gap-2">
                    {icon(t)}
                    <span className="inline-flex flex-col">
                      <a
                        href={githubIssueLink(t.issue)}
                        className="text-blue-500 dark:text-blue-400"
                      >
                        {t.issue.repository.organization.name}/
                        {t.issue.repository.name}#{t.issue.number}
                      </a>
                      {t.issue.title}
                    </span>
                  </div>
                </td>
                <td className="dark:text-polar-400 whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 ">
                      {t.pledger?.avatar_url && (
                        <img
                          src={t.pledger.avatar_url}
                          className="h-6 w-6 rounded-full"
                        />
                      )}
                      <span>{t.pledger?.name || 'Anonymous'}</span>
                    </div>

                    {t.type === PledgeType.ON_COMPLETION && (
                      <div className="text-sx w-fit whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-600 dark:bg-blue-800 dark:text-blue-200">
                        Pay on completion
                      </div>
                    )}

                    {t.type === PledgeType.UPFRONT && (
                      <div className="text-sx w-fit whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-600 dark:bg-blue-800 dark:text-blue-200">
                        Pay upfront
                      </div>
                    )}
                  </div>
                </td>

                <td className="dark:text-polar-400 whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                  {formatDate(dateOrString(t.created_at))}
                </td>

                {showEstimatedPayoutDate && (
                  <td className="dark:text-polar-400 whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    <div>
                      {(t.scheduled_payout_at &&
                        formatDate(dateOrString(t.scheduled_payout_at))) ||
                        'Unknown'}
                    </div>
                  </td>
                )}

                {showRefundedDate && (
                  <td className="dark:text-polar-400 whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    {(t.refunded_at &&
                      formatDate(dateOrString(t.refunded_at))) ||
                      'Unknown'}
                  </td>
                )}

                <td className="whitespace-nowrap py-3 pr-3 text-sm">
                  <div className="dark:text-polar-400 text-right text-gray-500">
                    ${getCentsInDollarString(t.amount.amount, true, true)}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default List

const formatDate = (d: Date): string => {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
