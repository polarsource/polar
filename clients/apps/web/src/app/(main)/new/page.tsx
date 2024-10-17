import PledgeByLink from '@/components/Pledge/PledgeByLink'
import { parseGitHubIssueLink } from '@/utils/github'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Create a new pledge',
}

export default function Page({
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
