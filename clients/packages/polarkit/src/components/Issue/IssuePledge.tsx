import { Platforms, PledgeRead, PledgeState } from 'polarkit/api/client'
import { useIssueMarkConfirmed } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useMemo } from 'react'
import IssueConfirmButton from './IssueConfirmButton'

interface Props {
  orgName: string
  repoName: string
  issueNumber: number
  pledges: PledgeRead[]
}

const IssuePledge = (props: Props) => {
  const markConfirmed = useIssueMarkConfirmed()

  const { orgName, repoName, issueNumber, pledges } = props

  const totalPledgeAmount = pledges.reduce(
    (accumulator, pledge) => accumulator + pledge.amount,
    0,
  )

  const confirmPledges = async () => {
    await markConfirmed.mutateAsync({
      platform: Platforms.GITHUB,
      orgName,
      repoName,
      issueNumber,
    })
  }

  const confirmable = useMemo(() => {
    return (
      pledges.some(
        (p) =>
          p.state === PledgeState.CONFIRMATION_PENDING &&
          p.authed_user_can_admin,
      ) && !markConfirmed.isLoading
    )
  }, [pledges, markConfirmed])

  const isConfirmed = useMemo(() => {
    return (
      !confirmable &&
      pledges.some(
        (p) => p.state === PledgeState.PENDING && p.authed_user_can_admin,
      ) &&
      !markConfirmed.isLoading
    )
  }, [pledges, markConfirmed, confirmable])

  return (
    <>
      <div className="flex flex-row items-center justify-center space-x-4">
        <p className="flex-shrink-0 rounded-2xl bg-blue-800 px-3 py-1 text-sm text-blue-300 dark:bg-blue-200 dark:text-blue-700">
          ${' '}
          <span className="whitespace-nowrap text-blue-100 dark:text-blue-900">
            {getCentsInDollarString(totalPledgeAmount)}
          </span>
        </p>
        {isConfirmed && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-500">
            Confirmed
          </span>
        )}
        {markConfirmed.isLoading && (
          <span className="text-sm font-medium text-gray-600  dark:text-gray-500">
            Confirming...
          </span>
        )}
        {confirmable && <IssueConfirmButton onClick={confirmPledges} />}
      </div>
    </>
  )
}

export default IssuePledge
