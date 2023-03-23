import { ExternalGitHubPullRequestReference } from '../api/client'
import GitMergeIcon from './icons/GitMergeIcon'
import GitPullRequestIcon from './icons/GitPullRequestIcon'

const IssueReferenceExternalGitHubCommit = (props: {
  pr: ExternalGitHubPullRequestReference
}) => {
  const pr = props.pr

  if (!pr) return <></>

  let backgroundColor = 'bg-gray-50'
  let borderColor = 'border-gray-100'

  const isMerged = pr.state === 'closed'

  if (pr.state == 'open') {
    backgroundColor = 'bg-green-50'
    borderColor = 'border-green-100'
  } else if (pr.state == 'closed') {
    backgroundColor = 'bg-purple-50'
    borderColor = 'border-purple-100'
  }

  const href = `https://github.com/${pr.organization_name}/${pr.repository_name}/pull/${pr.number}`

  return (
    <>
      <div
        className={`rounded-xl p-2 ${backgroundColor} border-2 ${borderColor} flex justify-between`}
      >
        <div className="flex items-center gap-2">
          <img
            className="h-8 w-8 rounded-full border-2 border-white bg-gray-200"
            src={pr.author_avatar}
          />
          {isMerged && <GitMergeIcon />}
          {!isMerged && <GitPullRequestIcon />}
          <a href={href}>
            {pr.organization_name}/{pr.repository_name}#{pr.number}
          </a>
          <a href={href}>
            <strong>{pr.title}</strong>
          </a>
          <span className="text-gray-500">{pr.author_login}</span>
        </div>
      </div>
    </>
  )
}

export default IssueReferenceExternalGitHubCommit
