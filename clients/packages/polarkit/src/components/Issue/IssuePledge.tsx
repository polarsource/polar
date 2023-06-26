import { Platforms, PledgeRead, PledgeState } from 'polarkit/api/client'
import { useIssueMarkConfirmed } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
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

  const confirmable = pledges.some(
    (p) => p.state === PledgeState.CONFIRMATION_PENDING,
  )

  const confirmPledges = async () => {
    markConfirmed.mutate({
      platform: Platforms.GITHUB,
      orgName,
      repoName,
      issueNumber,
    })
  }

  return (
    <>
      <div className="flex flex-row items-center justify-center space-x-4">
        <p className="flex-shrink-0 rounded-2xl bg-blue-800 px-3 py-1 text-sm text-blue-300 dark:bg-blue-200 dark:text-blue-700">
          ${' '}
          <span className="whitespace-nowrap text-blue-100 dark:text-blue-900">
            {getCentsInDollarString(totalPledgeAmount)}
          </span>
        </p>
        {confirmable && <IssueConfirmButton onClick={confirmPledges} />}
      </div>
    </>
  )
}

export default IssuePledge
