import { IssueReferenceRead, PledgeRead } from '../api/client'
import IssuePledge from './IssuePledge'
import IssueReference from './IssueReference'

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
}) => (
  <>
    {pledges &&
      pledges.map((pledge: PledgeRead) => {
        return <IssuePledge pledge={pledge} key={pledge.id} />
      })}

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
  </>
)

export default IssueListItemDecoration
