import {
  IssueReferenceRead,
  OrganizationRead,
  PledgeRead,
  RepositoryRead,
} from 'api/client'
import IssuePledge from './IssuePledge'
import IssueReference from './IssueReference'

const IssueListItemDecoration = ({
  org,
  repo,
  pledges,
  references,
}: {
  org: OrganizationRead
  repo: RepositoryRead
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
        return <IssueReference org={org} repo={repo} reference={r} key={r.id} />
      })}
  </>
)

export default IssueListItemDecoration
