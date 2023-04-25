import { IssueReferenceRead, PledgeRead } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'
import IssuePledge from './Pledge'
import IssueReference from './Reference'

const IssueListItemDecoration = ({
  orgName,
  repoName,
  pledges,
  references,
}: {
  orgName: string
  repoName: string
  pledges: PledgeRead[]
  references: IssueReferenceRead[]
}) => {
  return (
    <div className="flex flex-row items-center">
      {pledges && (
        <div className="stretch mr-4 flex-none">
          <IssuePledge pledges={pledges} />
        </div>
      )}

      <div className={classNames(pledges ? 'border-l pl-4' : '', 'flex-1')}>
        {references &&
          references.map((r: IssueReferenceRead) => {
            return (
              <IssueReference
                orgName={orgName}
                repoName={repoName}
                reference={r}
                key={r.id}
              />
            )
          })}

        {!references && (
          <p className="text-sm italic text-gray-400">Not picked up yet</p>
        )}
      </div>
    </div>
  )
}

export default IssueListItemDecoration
