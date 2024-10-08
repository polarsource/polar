'use client'

import IssueListItem from '@/components/Issues/IssueListItem'
import { api } from '@/utils/api'
import { FavoriteBorderOutlined } from '@mui/icons-material'
import { Issue, State } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { useEffect, useState } from 'react'

const Embed = (props: { src: string }) => {
  if (
    typeof props.src === 'string' &&
    props.src.startsWith('https://github.com/')
  ) {
    return <EmbedIssue src={props.src} />
  }

  return (
    <div className="bg-gray-200 p-2 text-red-800">Invalid &lt;embed&gt;</div>
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

    if (!realIssue) {
      get()
    }

    return () => {
      active = false
    }
  }, [m])

  if (!m || !m[0] || !m[1]) {
    return (
      <div className="bg-gray-200 p-2 text-red-800">Invalid &lt;embed&gt;</div>
    )
  }

  const tempIssue: Issue = {
    id: 'embed',
    title: `${m[1] || ''}/${m[2]}#${m[3]}`,
    platform: 'github',
    number: parseInt(m[3]),
    state: State.OPEN,
    issue_created_at: '',
    needs_confirmation_solved: false,
    funding: {},
    repository: {
      id: 'embed',
      platform: 'github',
      is_private: false,
      name: m[2],
      profile_settings: {},
      description: null,
      stars: null,
      license: null,
      homepage: null,
      organization: {
        id: 'embed',
        platform: 'github',
        name: m[1],
        avatar_url: '',
        is_personal: false,
        bio: null,
        pretty_name: null,
        company: null,
        blog: null,
        location: null,
        email: null,
        twitter_username: null,
        organization_id: null,
      },
    },
    pledge_badge_currently_embedded: false,
  }

  const issue = realIssue ?? tempIssue

  return (
    <div className="not-prose dark:bg-polar-800 border-bg-gray-100 dark:border:bg-polar-700 my-2 overflow-hidden rounded-2xl border bg-gray-50">
      <IssueListItem
        issue={issue}
        references={[]}
        pledges={[]}
        pledgesSummary={null}
        rewards={null}
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
