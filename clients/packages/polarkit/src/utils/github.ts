export const githubRepoUrl = (owner: string, repo: string) =>
  `https://www.github.com/${owner}/${repo}`

export const githubIssueUrl = (owner: string, repo: string, number: number) =>
  `${githubRepoUrl(owner, repo)}/issues/${number}`

export const githubPullReqeustUrl = (
  owner: string,
  repo: string,
  number: number,
) => `${githubRepoUrl(owner, repo)}/pull/${number}`
