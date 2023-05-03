import { BackofficePledgeRead } from 'polarkit/api/client'
import { ThinButton } from 'polarkit/components/ui'
import {
  useBackofficePledgeApprove,
  useBackofficePledgeMarkPending,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useState, type MouseEvent } from 'react'

const PledgeItem = ({
  pledge,
  showActions,
}: {
  pledge: BackofficePledgeRead
  showActions: boolean
}) => {
  const approver = useBackofficePledgeApprove()
  const markPending = useBackofficePledgeMarkPending()

  const [isLoadingApprove, setIsLoadingApprove] = useState(false)
  const [isLoadingPending, setIsLoadingPending] = useState(false)

  const clickApprove = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsLoadingApprove(true)
    await approver.mutateAsync({ pledgeId: pledge.id })
    setIsLoadingApprove(false)
  }

  const clickMarkPending = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsLoadingPending(true)
    await markPending.mutateAsync({ pledgeId: pledge.id })
    setIsLoadingPending(false)
  }

  return (
    <tr>
      <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-900">
        <div className="flex items-center space-x-1">
          <img className="h-6 w-6" src={pledge.pledger_avatar} />
          <a href={`https://github.com/${pledge.pledger_name}`}>
            {pledge.pledger_name}
          </a>
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-900">
        <a href={`https://github.com/${pledge.receiver_org_name}`}>
          {pledge.receiver_org_name}
        </a>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
        <div className="flex flex-col">
          {pledge.state}
          <Pills state={pledge.state} />
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
        <a className="underline" href={pledge.issue_url}>
          {pledge.issue_title}
        </a>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
        ${getCentsInDollarString(pledge.amount)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
        {pledge.created_at.substring(0, 19)}
      </td>
      {showActions && (
        <td className="relative flex items-center space-x-1 whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
          {pledge.payment_id && (
            <ThinButton
              color="gray"
              href={`https://dashboard.stripe.com/payments/${pledge.payment_id}`}
            >
              Payment
            </ThinButton>
          )}

          {pledge.transfer_id && (
            <ThinButton
              color="gray"
              href={`https://dashboard.stripe.com/connect/transfers/${pledge.transfer_id}`}
            >
              Transfer
            </ThinButton>
          )}

          {pledge.state === 'pending' && (
            <>
              <ThinButton onClick={clickApprove} loading={isLoadingApprove}>
                Approve
              </ThinButton>
            </>
          )}

          {pledge.state === 'created' && (
            <>
              <ThinButton onClick={clickMarkPending} loading={isLoadingPending}>
                Mark Pending
              </ThinButton>
            </>
          )}
        </td>
      )}
    </tr>
  )
}

const Pill = ({ className }: { className: string }) => (
  <div className={`h-2 w-2 rounded-full ${className}`}></div>
)

const Pills = ({ state }: { state: string }) => {
  const states = {
    created: { num: 1, color: 'bg-blue-400' },
    pending: { num: 2, color: 'bg-blue-400' },
    paid: { num: 3, color: 'bg-blue-400' },
    refunded: { num: 2, color: 'bg-red-400' },
    disputed: { num: 4, color: 'bg-red-400' },
  }
  const pillState = states[state] || { num: 0, color: 'bg-blue-400' }
  const filled = [...Array(pillState.num)]
  const pending = [...Array(4 - pillState.num)]

  console.log(filled, pending)

  return (
    <div className="flex items-center space-x-1">
      {filled.map((_, index) => (
        <Pill key={index} className={pillState.color} />
      ))}
      {pending.map((_, index) => (
        <Pill key={index} className="bg-gray-200" />
      ))}
    </div>
  )
}

export default PledgeItem
