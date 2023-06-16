import {
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/20/solid'
import Image from 'next/image'
import { BackofficePledgeRead, PledgeState } from 'polarkit/api/client'
import { ThinButton } from 'polarkit/components/ui'
import {
  useBackofficePledgeApprove,
  useBackofficePledgeMarkDisputed,
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
  const markDisputed = useBackofficePledgeMarkDisputed()

  const [isLoadingApprove, setIsLoadingApprove] = useState(false)
  const [isLoadingPending, setIsLoadingPending] = useState(false)
  const [isLoadingDisputed, setIsLoadingDisputed] = useState(false)

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

  const canDisputeStates = [PledgeState.PENDING, PledgeState.CREATED]
  const canDispute = canDisputeStates.includes(pledge.state)

  const clickAddDispute = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsLoadingDisputed(true)
    await markDisputed.mutateAsync({ pledgeId: pledge.id })
    setIsLoadingDisputed(false)
  }

  const [showDisputeDetails, setShowDisputeDetails] = useState(false)

  const clickShowDispute = () => {
    setShowDisputeDetails(!showDisputeDetails)
  }

  const canPayout =
    pledge.state === PledgeState.PENDING &&
    pledge.scheduled_payout_at &&
    new Date(pledge.scheduled_payout_at) < new Date()

  return (
    <>
      <tr>
        <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-900">
          <div className="flex items-center space-x-1">
            {pledge.pledger_avatar && (
              <Image
                className="h-6 w-6"
                src={pledge.pledger_avatar}
                alt={`Avatar`}
                height={200}
                width={200}
              />
            )}
            {pledge.pledger_name && (
              <a href={`https://github.com/${pledge.pledger_name}`}>
                {pledge.pledger_name}
              </a>
            )}
            {pledge.pledger_email && <span>{pledge.pledger_email}</span>}
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
          <table>
            <tr>
              <td className="pr-2 font-medium">Created</td>
              <td>{pledge.created_at.substring(0, 19)}</td>
            </tr>
            {pledge.scheduled_payout_at && (
              <tr>
                <td className="pr-2 font-medium">Payout</td>
                <td>{pledge.scheduled_payout_at.substring(0, 19)}</td>
              </tr>
            )}
          </table>
        </td>

        {showActions && (
          <td className="relative flex items-center space-x-1 whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
            {pledge.payment_id && (
              <ThinButton
                color="gray"
                href={`https://dashboard.stripe.com/payments/${pledge.payment_id}`}
              >
                <span>Payment</span>
                <ArrowTopRightOnSquareIcon />
              </ThinButton>
            )}

            {pledge.transfer_id && (
              <ThinButton
                color="gray"
                href={`https://dashboard.stripe.com/connect/transfers/${pledge.transfer_id}`}
              >
                <span>Transfer</span>
                <ArrowTopRightOnSquareIcon />
              </ThinButton>
            )}

            {canPayout && (
              <>
                <ThinButton
                  onClick={clickApprove}
                  loading={isLoadingApprove}
                  color="green"
                >
                  <span>Payout</span>

                  <NextState>
                    <>Paid</>
                  </NextState>
                </ThinButton>
              </>
            )}

            {pledge.state === PledgeState.CREATED && (
              <>
                <ThinButton
                  onClick={clickMarkPending}
                  loading={isLoadingPending}
                >
                  <span>Fast Track</span>
                  <NextState>
                    <>Pending</>
                  </NextState>
                </ThinButton>
              </>
            )}

            {canDispute && (
              <>
                <ThinButton
                  onClick={clickAddDispute}
                  color="red"
                  loading={isLoadingDisputed}
                >
                  Dispute
                </ThinButton>
              </>
            )}

            {pledge.state == PledgeState.DISPUTED && (
              <>
                <ThinButton onClick={clickShowDispute} color="blue">
                  {showDisputeDetails ? 'Hide Dispute' : 'Show Dispute'}
                </ThinButton>
              </>
            )}
          </td>
        )}
      </tr>

      {showDisputeDetails && (
        <>
          <tr>
            <td>&nbsp;</td>
            <td colSpan={5}>
              <h2>Dispute Description</h2>
              <blockquote>{pledge.dispute_reason}</blockquote>
            </td>
            <td className="relative flex items-center space-x-1 whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
              <ThinButton
                color="gray"
                href={`https://dashboard.stripe.com/payments/${pledge.payment_id}`}
              >
                <span>Refund (via Stripe)</span>
                <ArrowTopRightOnSquareIcon />
              </ThinButton>
              <ThinButton onClick={clickMarkPending} loading={isLoadingPending}>
                <span>Reject Dispute</span>
                <NextState>
                  <>Pending</>
                </NextState>
              </ThinButton>
            </td>
          </tr>
        </>
      )}
    </>
  )
}

const Pill = ({ className }: { className: string }) => (
  <div className={`h-2 w-2 rounded-full ${className}`}></div>
)

const Pills = ({ state }: { state: string }) => {
  const states: Map<string, { num: number; color: string }> = new Map(
    Object.entries({
      created: { num: 1, color: 'bg-blue-400' },
      pending: { num: 2, color: 'bg-blue-400' },
      paid: { num: 3, color: 'bg-blue-400' },
      refunded: { num: 2, color: 'bg-red-400' },
      disputed: { num: 4, color: 'bg-red-400' },
    }),
  )

  const pillState = states.get(state) || { num: 0, color: 'bg-blue-400' }
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

const DisputeModal = () => {
  // x
}

const NextState = (props: { children: React.ReactElement }) => {
  return (
    <div className="inline-flex">
      <span>(</span>
      <ArrowRightCircleIcon className="mr-1 h-4 w-4" />{' '}
      <span>{props.children}</span>
      <span>)</span>
    </div>
  )
}
