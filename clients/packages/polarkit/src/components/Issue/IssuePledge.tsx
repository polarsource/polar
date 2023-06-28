import { PledgeRead, PledgeState } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/money'
import { useMemo } from 'react'
import IssueConfirmButton from './IssueConfirmButton'

interface Props {
  orgName: string
  repoName: string
  issueNumber: number
  pledges: PledgeRead[]
  onConfirmPledges: (
    orgName: string,
    repoName: string,
    issueNumber: number,
  ) => Promise<void>
  showConfirmPledgeAction: boolean
  confirmPledgeIsLoading: boolean
}

const IssuePledge = (props: Props) => {
  const {
    orgName,
    repoName,
    issueNumber,
    pledges,
    showConfirmPledgeAction,
    confirmPledgeIsLoading,
  } = props

  const totalPledgeAmount = pledges.reduce(
    (accumulator, pledge) => accumulator + pledge.amount,
    0,
  )

  const confirmPledges = async () => {
    await props.onConfirmPledges(orgName, repoName, issueNumber)
  }

  const confirmable = useMemo(() => {
    return (
      pledges.some(
        (p) =>
          p.state === PledgeState.CONFIRMATION_PENDING &&
          p.authed_user_can_admin_received,
      ) && !confirmPledgeIsLoading
    )
  }, [pledges, confirmPledgeIsLoading])

  const isConfirmed = useMemo(() => {
    return (
      !confirmable &&
      pledges.some(
        (p) =>
          p.state === PledgeState.PENDING && p.authed_user_can_admin_received,
      ) &&
      !confirmPledgeIsLoading
    )
  }, [pledges, confirmPledgeIsLoading, confirmable])

  return (
    <>
      <div className="flex flex-row items-center justify-center space-x-4">
        <p className="flex-shrink-0 rounded-2xl bg-blue-800 px-3 py-1 text-sm text-blue-300 dark:bg-blue-200 dark:text-blue-700">
          ${' '}
          <span className="whitespace-nowrap text-blue-100 dark:text-blue-900">
            {getCentsInDollarString(totalPledgeAmount)}
          </span>
        </p>

        {showConfirmPledgeAction && (
          <>
            {isConfirmed && (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-500">
                Solved
              </span>
            )}
            {confirmPledgeIsLoading && (
              <span className="text-sm font-medium text-gray-600 dark:text-gray-500">
                Loading...
              </span>
            )}
            {confirmable && <IssueConfirmButton onClick={confirmPledges} />}
          </>
        )}
      </div>
    </>
  )
}

export default IssuePledge
