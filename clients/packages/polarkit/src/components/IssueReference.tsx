import {
  ExternalGitHubCommitReference,
  ExternalGitHubPullRequestReference,
  IssueReferenceRead,
  IssueReferenceType,
  OrganizationRead,
  RepositoryRead,
  type PullRequestReference,
} from '../api/client'
import IssueReferenceExternalGitHubCommit from './IssueReferenceExternalGitHubCommit'
import IssueReferenceExternalGitHubPullRequest from './IssueReferenceExternalGitHubPullRequest'
import IssueReferencePullRequest from './IssueReferencePullRequest'

const IssueReference = (props: {
  org: OrganizationRead
  repo: RepositoryRead
  reference: IssueReferenceRead
}) => {
  const { reference } = props

  if (reference && reference.type === IssueReferenceType.PULL_REQUEST) {
    return (
      <IssueReferencePullRequest
        org={props.org}
        repo={props.repo}
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
          pr={reference.payload as ExternalGitHubPullRequestReference}
        />
      </>
    )
  }

  return <></>
}

export default IssueReference
