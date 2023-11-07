'use client'

import {
  BackofficeBadgeActionEnum,
  BackofficeBadgeResponse,
} from '@polar-sh/sdk'
import { useBackofficeBadgeAction } from 'polarkit/hooks'
import { useState } from 'react'

const Badge = () => {
  const [orgSlug, setOrgSlug] = useState('')
  const [repoSlug, setRepoSlug] = useState('')
  const [issueNumber, setIssueNumber] = useState(0)
  const [action, setAction] = useState<BackofficeBadgeActionEnum>(
    BackofficeBadgeActionEnum.EMBED,
  )
  const [successURL, setSuccessURL] = useState('')

  const manageBadgeMutation = useBackofficeBadgeAction()

  const generateGitHubURL = (badge: BackofficeBadgeResponse) => {
    return `https://github.com/${badge.org_slug}/${badge.repo_slug}/issues/${badge.issue_number}`
  }

  const onSubmit = async () => {
    const res = await manageBadgeMutation.mutateAsync({
      org_slug: orgSlug,
      repo_slug: repoSlug,
      issue_number: issueNumber,
      action: action,
    })

    if (res.success) {
      setSuccessURL(generateGitHubURL(res))
    }
  }

  return (
    <>
      {successURL && (
        <div className="bg-green-200 px-4 py-2">
          <strong>Success!</strong>{' '}
          <a href={successURL} target="_blank" rel="noopener noreferrer">
            {successURL}
          </a>
        </div>
      )}
      <form>
        <div className="mt-4">
          <label htmlFor="org-slug" className="block">
            Org Slug
          </label>
          <input
            type="text"
            id="org-slug"
            onChange={(e) => {
              setOrgSlug(e.target.value)
            }}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="repo-slug" className="block">
            Repo Slug
          </label>
          <input
            type="text"
            id="repo-slug"
            onChange={(e) => {
              setRepoSlug(e.target.value)
            }}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="issue-number" className="block">
            Issue Number
          </label>
          <input
            type="text"
            id="issue-number"
            onChange={(e) => {
              setIssueNumber(parseInt(e.target.value))
            }}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="action" className="block">
            Action
          </label>
          <select
            id="action"
            onChange={(e) => {
              if (e.target.value == BackofficeBadgeActionEnum.REMOVE) {
                return setAction(BackofficeBadgeActionEnum.REMOVE)
              }
              setAction(BackofficeBadgeActionEnum.EMBED)
            }}
            value={action}
          >
            <option value={BackofficeBadgeActionEnum.EMBED}>Embed</option>
            <option value={BackofficeBadgeActionEnum.REMOVE}>Remove</option>
          </select>
        </div>

        <button
          type="submit"
          className="mt-4 bg-black p-4 text-white"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSubmit()
          }}
        >
          {action == 'embed' ? 'Embed' : 'Remove'} Badge
        </button>
      </form>
    </>
  )
}

export default Badge
