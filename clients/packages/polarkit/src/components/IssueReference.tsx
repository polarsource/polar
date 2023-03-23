import {
  ExternalGitHubCommitReference,
  ExternalGitHubPullRequestReference,
  IssueReferenceRead,
  IssueReferenceType,
  type IssueRead,
  type PullRequestReference,
} from '../api/client'
import IssueReferenceExternalGitHubCommit from './IssueReferenceExternalGitHubCommit'
import IssueReferenceExternalGitHubPullRequest from './IssueReferenceExternalGitHubPullRequest'
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

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_COMMIT
  ) {
    return (
      <IssueReferenceExternalGitHubCommit
        issue={issue}
        commit={reference.payload as ExternalGitHubCommitReference}
      />
    )
  }

  if (
    reference &&
    reference.type === IssueReferenceType.EXTERNAL_GITHUB_PULL_REQUEST
  ) {
    return (
      <>
        <IssueReferenceExternalGitHubPullRequest
          issue={issue}
          pr={reference.payload as ExternalGitHubPullRequestReference}
        />
      </>
    )
  }

  return <></>
}

export default IssueReference
