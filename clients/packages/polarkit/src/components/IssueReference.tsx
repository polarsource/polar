import {
  IssueReferenceRead,
  IssueReferenceType,
  type IssueRead,
  type PullRequestReference,
} from '../api/client'
import IssueReferencePullRequest from './IssueReferencePullRequest'

const IssueReference = (props: {
  issue: IssueRead
  reference: IssueReferenceRead
}) => {
  const { issue, reference } = props

  if (reference && reference.type === IssueReferenceType.PULL_REQUEST) {
    return (
      <IssueReferencePullRequest
        issue={issue}
        pr={reference.payload as PullRequestReference}
      />
    )
  }

  return (
    <pre>
      <br />
      {JSON.stringify(reference)}
    </pre>
  )
}

export default IssueReference
