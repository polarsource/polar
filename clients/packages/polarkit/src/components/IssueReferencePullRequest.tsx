import ReactTimeAgo from 'react-time-ago'
import {
  OrganizationRead,
  PullRequestReference,
  RepositoryRead,
} from '../api/client'
import GitMergeIcon from './icons/GitMergeIcon'
import GitPullRequestIcon from './icons/GitPullRequestIcon'

const IssueReference = (props: {
  pr: PullRequestReference
  org: OrganizationRead
  repo: RepositoryRead
}) => {
  const pr = props.pr

  if (!pr) return <></>

  let backgroundColor = 'bg-gray-800'
  let borderColor = 'border-gray-800'

  const isMerged = pr.state === 'closed' && pr.merged_at

  if (pr.state == 'open') {
    backgroundColor = 'bg-green-50'
    borderColor = 'border-green-100'
  } else if (pr.state == 'closed') {
    backgroundColor = 'bg-purple-50'
    borderColor = 'border-purple-100'
  }

  const href = `https://github.com/${props.org.name}/${props.repo.name}/pull/${pr.number}`

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
            <strong>{pr.title}</strong>
          </a>
          <span className="text-gray-500">
            <a href={href}>#{pr.number}</a> opened{' '}
            <ReactTimeAgo date={new Date(pr.created_at)} /> by {pr.author_login}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="space-x-2">
            {pr.additions !== undefined && (
              <span className="text-green-400">+{pr.additions}</span>
            )}
            {pr.deletions !== undefined && (
              <span className="text-red-400">-{pr.deletions}</span>
            )}
          </div>
          {pr.state == 'open' && (
            <a
              href="#"
              className="rounded-md bg-green-600 py-1 px-2 text-sm text-white"
            >
              Review
            </a>
          )}
          {pr.state == 'closed' && (
            <a
              href="#"
              className="rounded-md bg-purple-600 py-1 px-2 text-sm text-white"
            >
              Reward
            </a>
          )}
        </div>
      </div>
    </>
  )
}

export default IssueReference
