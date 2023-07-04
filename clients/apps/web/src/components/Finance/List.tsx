import CheckIcon from '@/components/Icons/CheckIcon'
import DollarSignIcon from '@/components/Icons/DollarSignIcon'
import EyeIcon from '@/components/Icons/EyeIcon'
import Icon from '@/components/Icons/Icon'
import RefundIcon from '@/components/Icons/RefundIcon'
import { PledgeRead, PledgeResources, PledgeState } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'

export type Column = 'ESTIMATED_PAYOUT_DATE' | 'PAID_OUT_DATE' | 'REFUNDED_DATE'

const List = (props: {
  pledges: PledgeResources[]
  columns: Column[]
  title: string
  subtitle: string
}) => {
  const { pledges, columns, title, subtitle } = props

  const icon = (pledge: PledgeRead) => {
    if (
      pledge.state === PledgeState.CONFIRMATION_PENDING ||
      pledge.state === PledgeState.PENDING ||
      pledge.state === PledgeState.DISPUTED
    ) {
      return <Icon classes="bg-gray-200 text-gray-600" icon={<EyeIcon />} />
    }
    if (pledge.state === PledgeState.PAID) {
      return <Icon classes="bg-green-200 text-green-600" icon={<CheckIcon />} />
    }
    if (
      pledge.state === PledgeState.REFUNDED ||
      pledge.state === PledgeState.CHARGE_DISPUTED
    ) {
      return <Icon classes="bg-red-200 text-red-600" icon={<RefundIcon />} />
    }

    return (
      <Icon classes="bg-blue-200 text-blue-600" icon={<DollarSignIcon />} />
    )
  }

  const issueLink = (pr: PledgeResources): string => {
    return `https://github.com/${pr.organization?.name}/${pr.repository?.name}/issues/${pr.issue?.number}`
  }

  const showEstimatedPayoutDate = columns.some(
    (c) => c === 'ESTIMATED_PAYOUT_DATE',
  )

  const showPaidOutDate = columns.some((c) => c === 'PAID_OUT_DATE')

  const showRefundedDate = columns.some((c) => c === 'REFUNDED_DATE')

  return (
    <div>
      <h2 className="px-2 font-medium text-gray-900 dark:text-gray-500">
        {title}
      </h2>
      <table className="w-full text-left">
        <thead className="text-gray-900 dark:text-gray-500">
          <tr>
            <th
              scope="col"
              className="relative isolate  whitespace-nowrap px-2  py-3.5 text-left text-sm font-semibold "
            >
              {subtitle}
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap py-3.5 pr-2 text-left text-sm font-semibold "
            >
              Pledger
            </th>
            <th
              scope="col"
              className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-semibold"
            >
              Pledge date
            </th>
            {showEstimatedPayoutDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-semibold"
              >
                Est. payout date
              </th>
            )}
            {showPaidOutDate && (
              <th
                scope="col"
                className="relative isolate whitespace-nowrap  py-3.5 pr-2 text-left text-sm font-semibold"
              >
                Paid out date
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
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {pledges &&
            pledges.map((t) => (
              <tr key={t.pledge.id}>
                <td className="px-2 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    {icon(t.pledge)}
                    <span className="inline-flex flex-col">
                      <a href={issueLink(t)} className="text-blue-600">
                        {t.organization?.name}/{t.repository?.name}#
                        {t.issue?.number}
                      </a>
                      {t.issue?.title}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1 ">
                    {t.pledge.pledger_avatar && (
                      <img
                        src={t.pledge.pledger_avatar}
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <span>{t.pledge.pledger_name || 'Anonymous'}</span>
                  </div>
                </td>

                <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                  {formatDate(t.pledge.created_at)}
                </td>

                {showEstimatedPayoutDate && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    {(t.pledge.scheduled_payout_at &&
                      formatDate(t.pledge.scheduled_payout_at)) ||
                      'Unknown'}
                  </td>
                )}

                {showPaidOutDate && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500 ">
                    {(t.pledge.paid_at && formatDate(t.pledge.paid_at)) ||
                      'Unknown'}
                  </td>
                )}

                {showRefundedDate && (
                  <td className="whitespace-nowrap py-3 pr-3 text-sm text-gray-500">
                    {(t.pledge.refunded_at &&
                      formatDate(t.pledge.refunded_at)) ||
                      'Unknown'}
                  </td>
                )}

                <td className="whitespace-nowrap py-3 pr-3 text-right text-sm text-gray-500">
                  ${getCentsInDollarString(t.pledge.amount, true)}
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
