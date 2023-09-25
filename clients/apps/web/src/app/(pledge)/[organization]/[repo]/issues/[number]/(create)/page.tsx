import Pledge from '@/components/Pledge/Pledge'
import { Metadata, ResolvingMetadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { buildAPI } from 'polarkit/api'
import { ApiError, Issue, Pledger } from 'polarkit/api/client'

const authedApi = () => {
  const cookieStore = cookies()
  const polarCookie = cookieStore.get('polar')
  const api = buildAPI({ token: polarCookie?.value })
  return api
}

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string; repo: string; number: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  let issue: Issue | undefined

  try {
    issue = await authedApi().issues.lookup({
      externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound()
    }
  }

  if (!issue) {
    return {}
  }

  return {
    title: `Fund: ${issue.title}`, // " | Polar is added by the template"
    openGraph: {
      title: `Fund: ${issue.title}`,
      description: `${issue.repository.organization.name} seeks funding for ${issue.title} Polar`,
      images: [
        {
          url: `https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`,
          width: 1200,
          height: 630,
          alt: `${issue.repository.organization.name} seeks funding for ${issue.title} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${issue.repository.organization.name} seeks funding for ${issue.title}`,
      description: `${issue.repository.organization.name} seeks funding for ${issue.title} on Polar`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; repo: string; number: string }
}) {
  let issue: Issue | undefined
  let issueHTMLBody: string | undefined
  let pledgers: Pledger[] = []

  try {
    const api = authedApi()
    issue = await api.issues.lookup({
      externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
    })
    const [bodyResponse, pledgeSummary] = await Promise.all([
      api.issues.getBody({ id: issue.id }),
      api.pledges.summary({ issueId: issue.id }),
    ])
    issueHTMLBody = bodyResponse
    pledgers = pledgeSummary.pledges.map(({ pledger }) => pledger)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound()
    }
  }

  if (!issue) {
    notFound()
  }

  return (
    <>
      <Pledge
        issue={issue}
        htmlBody={issueHTMLBody}
        pledgers={pledgers}
        gotoURL={undefined}
      />
    </>
  )
}
