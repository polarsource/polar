import IssueListItem from '@/components/Dashboard/IssueListItem'
import { FavoriteBorderOutlined } from '@mui/icons-material'
import { Issue } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit/api'
import { Button } from 'polarkit/components/ui/button'
import { useEffect, useState } from 'react'

const Embed = (props: { src: string }) => {
  if (
    typeof props.src === 'string' &&
    props.src.startsWith('https://github.com/')
  ) {
    return <EmbedIssue src={props.src} />
  }

  return (
    <div className="bg-gray-200 p-2 text-red-800">
      Unknown embed target ({props.src})
    </div>
  )
}

const EmbedIssue = (props: { src: string }) => {
  const m = props.src.match(
    /^https:\/\/github\.com\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/issues\/([0-9]+)/,
  )

  const [realIssue, setIssue] = useState<Issue>()
  useEffect(() => {
    let active = true
    const get = async () => {
      const i = await api.issues.lookup({
        externalUrl: props.src,
      })

      if (i && active) {
        setIssue(i)
      }
    }

    get()

    return () => {
      active = false
    }
  }, [m])

  if (!m || !m[0] || !m[1]) {
    return (
      <div className="bg-gray-200 p-2 text-red-800">
        Unknown embed target ({props.src})
      </div>
    )
  }

  const tempIssue: Issue = {
    id: 'embed',
    title: `${m[1] || ''}/${m[2]}#${m[3]}`,
    platform: 'github',
    number: parseInt(m[3]),
    state: 'OPEN',
    issue_created_at: '',
    needs_confirmation_solved: false,
    funding: {},
    repository: {
      id: 'embed',
      platform: 'github',
      visibility: 'public',
      name: m[2],
      organization: {
        id: 'embed',
        platform: 'github',
        name: m[1],
        avatar_url: '',
        pledge_minimum_amount: 0,
        pledge_badge_show_amount: false,
        is_teams_enabled: false,
      },
    },
    pledge_badge_currently_embedded: false,
  }

  const issue = realIssue ?? tempIssue

  return (
    <div className="not-prose my-2 overflow-hidden rounded-2xl bg-blue-50">
      <IssueListItem
        issue={issue}
        references={[]}
        pledges={[]}
        key={issue.id}
        canAddRemovePolarLabel={false}
        showPledgeAction={true}
        showLogo={false}
        right={
          <>
            <Link
              href={`/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`}
              className="font-medium text-blue-500"
            >
              <Button variant="secondary" size="sm">
                <FavoriteBorderOutlined fontSize="inherit" />
                <span className="ml-1.5">Fund</span>
              </Button>
            </Link>
          </>
        }
      />
    </div>
  )
}

export default Embed
