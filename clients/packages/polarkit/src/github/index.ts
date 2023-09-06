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
  const re =
    /^(?<owner>[a-z0-9][a-z0-9-]*)?(?:\/(?<repo>[a-z0-9_\.-]+))?#(?<number>\d+)|(?:https?:\/\/(?:www\.)?github\.com\/)(?<owner2>[a-z0-9][a-z0-9-]*)?(?:\/(?<repo2>[a-z0-9_\.-]+))?(?:#|\/issues\/)(?<number2>\d+)$/i
  const match = url.match(re)
  if (!match || !match.groups) return undefined
  return {
    raw: match[0],
    owner: match.groups.owner || match.groups.owner2,
    repo: match.groups.repo || match.groups.repo2,
    number: Number.parseInt(match.groups.number || match.groups.number2),
  }
}
