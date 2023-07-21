import { useState } from 'react'
import { BackofficeBadge } from 'polarkit/api/client'
import { useBackofficeBadgeAction } from 'polarkit/hooks'

const Badge = () => {
  const [orgSlug, setOrgSlug] = useState('')
  const [repoSlug, setRepoSlug] = useState('')
  const [issueNumber, setIssueNumber] = useState(0)
  const [action, setAction] = useState<BackofficeBadge.action>(BackofficeBadge.action.EMBED)

  const manageBadgeMutation = useBackofficeBadgeAction()

  const onSubmit = async () => {
    await manageBadgeMutation.mutateAsync({
      org_slug: orgSlug,
      repo_slug: repoSlug,
      issue_number: issueNumber,
      action: action,
    })
  }

  return (
    <>
      <form>
        <div className="mt-4">
          <label htmlFor="org-slug" className="block">Org Slug</label>
          <input type="text" id="org-slug" onChange={(e) => {
            setOrgSlug(e.target.value)
          }} />
        </div>

        <div className="mt-4">
          <label htmlFor="repo-slug" className="block">Repo Slug</label>
          <input type="text" id="repo-slug" onChange={(e) => {
            setRepoSlug(e.target.value)
          }} />
        </div>

        <div className="mt-4">
          <label htmlFor="issue-number" className="block">Issue Number</label>
          <input type="text" id="issue-number" onChange={(e) => {
            setIssueNumber(parseInt(e.target.value))
          }} />
        </div>

        <div className="mt-4">
          <label htmlFor="action" className="block">Action</label>
          <select
            id="action"
            onChange={(e) => {
              if (e.target.value == BackofficeBadge.action.REMOVE) {
                return setAction(BackofficeBadge.action.REMOVE)
              }
              setAction(BackofficeBadge.action.EMBED)
            }}
            value={action}
          >
            <option value={BackofficeBadge.action.EMBED}>Embed</option>
            <option value={BackofficeBadge.action.REMOVE}>Remove</option>
          </select>
        </div>

        <button type="submit" className="bg-black text-white p-4 mt-4" onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onSubmit()
        }}>
          {action == "embed" ? "Embed" : "Remove"} Badge
        </button>
      </form>
    </>
  )
}

export default Badge
