import { ExternalGitHubCommitReference } from '../api/client'

const IssueReferenceExternalGitHubCommit = (props: {
  commit: ExternalGitHubCommitReference
}) => {
  const commit = props.commit

  if (!commit) return <></>

  let backgroundColor = 'bg-gray-50'
  let borderColor = 'border-gray-100'

  const href = `https://github.com/${commit.organization_name}/${commit.repository_name}/commit/${commit.sha}`

  return (
    <>
      <div
        className={`rounded-xl p-2 ${backgroundColor} border-2 ${borderColor} flex justify-between`}
      >
        <div className="flex items-center gap-2">
          <img
            className="h-8 w-8 rounded-full border-2 border-white bg-gray-200"
            src={commit.author_avatar}
          />
          <span className="">
            Mentioned by {commit.author_login} in&nbsp;
            <a className="font-mono text-gray-500" href={href}>
              {commit.sha.substring(0, 6)}
            </a>
            ({commit.organization_name}/{commit.repository_name})
          </span>
        </div>
      </div>
    </>
  )
}

export default IssueReferenceExternalGitHubCommit
