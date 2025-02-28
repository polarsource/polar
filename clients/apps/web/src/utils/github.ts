import { schemas } from '@polar-sh/client'

export const githubIssueLink = (issue: schemas['Issue']): string => {
  return `https://github.com/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`
}

type GitHubIssue = {
  raw: string
  owner: string
  repo: string
  number: number
}

export const githubRepoUrl = (owner: string, repo: string) =>
  `https://github.com/${owner}/${repo}`

export const githubIssueUrl = (owner: string, repo: string, number: number) =>
  `${githubRepoUrl(owner, repo)}/issues/${number}`

export const githubPullReqeustUrl = (
  owner: string,
  repo: string,
  number: number,
) => `${githubRepoUrl(owner, repo)}/pull/${number}`

export const parseGitHubIssueLink = (url: string): GitHubIssue | undefined => {
  // Regex without named groups - using numbered capture groups instead
  // Group 1: owner (first pattern)
  // Group 2: repo (first pattern)
  // Group 3: issue number (first pattern)
  // Group 5: owner2 (second pattern)
  // Group 6: repo2 (second pattern)
  // Group 7: number2 (second pattern)
  const re =
    /^([a-z0-9][a-z0-9-]*)?(?:\/([a-z0-9_\.-]+))?#(\d+)|(?:https?:\/\/(?:www\.)?github\.com\/)([a-z0-9][a-z0-9-]*)?(?:\/([a-z0-9_\.-]+))?(?:#|\/issues\/)(\d+)(#.*)?$/i

  const match = url.match(re)
  if (!match) return undefined

  // Extract values from the appropriate capture groups
  const owner = match[1] || match[4]
  const repo = match[2] || match[5]
  const issueNumber = match[3] || match[6]

  if (!owner || !repo || !issueNumber) return undefined

  return {
    raw: match[0],
    owner,
    repo,
    number: Number.parseInt(issueNumber),
  }
}
