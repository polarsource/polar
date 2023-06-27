import PledgeByLink from '@/components/Pledge/PledgeByLink'
import { redirect } from 'next/navigation'
import { parseGitHubIssueLink } from 'polarkit/github'

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  let link = ''
  let errorMessage = ''

  if (searchParams['link'] && typeof searchParams['link'] === 'string') {
    const issue = parseGitHubIssueLink(searchParams['link'])
    if (issue) {
      redirect(`/${issue.owner}/${issue.repo}/issues/${issue.number}`)
    }

    link = searchParams['link']
    errorMessage = 'Invalid GitHub issue link'
  }

  return <PledgeByLink initLinkValue={link} initErrorMessage={errorMessage} />
}
