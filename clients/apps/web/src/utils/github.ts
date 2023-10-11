import { Issue } from '@polar-sh/sdk'

export const githubIssueLink = (issue: Issue): string => {
  return `https://github.com/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`
}
