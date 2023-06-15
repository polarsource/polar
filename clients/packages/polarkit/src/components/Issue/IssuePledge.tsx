import { api } from 'polarkit/api'
import { Platforms, PledgeRead, PledgeState } from 'polarkit/api/client'
import { getCentsInDollarString } from 'polarkit/utils'
import IssueConfirmButton from './IssueConfirmButton'

interface Props {
  orgName: string
  repoName: string
  issueNumber: number
  pledges: PledgeRead[]
}

const IssuePledge = (props: Props) => {
  const { orgName, repoName, issueNumber, pledges } = props

  const totalPledgeAmount = pledges.reduce(
    (accumulator, pledge) => accumulator + pledge.amount,
    0,
  )

  const confirmable = pledges.some(
    (p) => p.state === PledgeState.CONFIRMATION_PENDING,
  )

  const confirmPledges = async () => {
    await api.pledges.confirmPledges({
      platform: Platforms.GITHUB,
      orgName,
      repoName,
      number: issueNumber,
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <p className="space-x-1 rounded-2xl bg-blue-800 px-3 py-1 text-sm text-blue-300 dark:bg-blue-200 dark:text-blue-700">
          ${' '}
          <span className="text-blue-100 dark:text-blue-900">
            {getCentsInDollarString(totalPledgeAmount)}
          </span>
        </p>
      </div>
      {confirmable && <IssueConfirmButton onClick={confirmPledges} />}
    </>
  )
}

export default IssuePledge
