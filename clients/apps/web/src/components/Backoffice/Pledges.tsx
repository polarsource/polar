import { BackofficePledgeRead } from 'polarkit/api/client'
import { ThinButton } from 'polarkit/components/ui'
import {
  useBackofficeAllPledges,
  useBackofficePledgeApprove,
  useBackofficePledgeMarkPending,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useState, type MouseEvent } from 'react'

const Pledges = () => {
  const pledges = useBackofficeAllPledges()
  const data = pledges.data
  return (
    <>
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Pledger
            </th>
            <th
              scope="col"
              className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Receiver
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              State
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Issue
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Amount
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Time
            </th>
            <th
              scope="col"
              className="relative whitespace-nowrap py-3.5 pl-3 pr-4 sm:pr-0"
            >
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data && data.map((p) => <PledgeItem pledge={p} key={p.id} />)}
        </tbody>
      </table>
    </>
  )
}

export default Pledges

const PledgeItem = ({ pledge }: { pledge: BackofficePledgeRead }) => {
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
    </tr>
  )
}

const Pill = ({ className }: { className: string }) => (
  <div className={`h-2 w-2 rounded-full ${className}`}></div>
)

const Pills = ({ state }: { state: string }) => {
  const nums = {
    created: 1,
    pending: 2,
    paid: 3,
  }
  const n = nums[state] || 0
  const filled = [...Array(n)]
  const pending = [...Array(4 - n)]

  return (
    <div className="flex items-center space-x-1">
      {filled.map(() => (
        <Pill className="bg-blue-400" />
      ))}
      {pending.map(() => (
        <Pill className="bg-gray-200" />
      ))}
    </div>
  )
}
