import { useAuth } from '@/hooks'
import {
  useIssue,
  useIssueMarkConfirmed,
  useListPledesForIssue,
  useListPullsReferencingIssue,
  useOrganization,
} from '@/hooks/queries'
import { Author, ConfirmIssueSplit } from '@polar-sh/sdk'
import { useState } from 'react'
import Spinner from '../Shared/Spinner'
import Split, { Contributor, Share } from './Split'
import SplitNotify from './SplitNotify'

const SplitRewardModal = (props: { issueId: string; onClose: () => void }) => {
  const { data: issue } = useIssue(props.issueId)
  const { data: organization } = useOrganization(
    issue?.repository.organization.organization_id as string,
    issue !== undefined &&
      issue.repository.organization.organization_id !== undefined,
  )
  const pledges = useListPledesForIssue(props.issueId)
  const pulls = useListPullsReferencingIssue(props.issueId)

  const { currentUser } = useAuth()

  const [showNotifyScreen, setShowNotifyScreen] = useState(false)
  const [notifySplits, setNotifySplits] = useState<ConfirmIssueSplit[]>([])

  const markSolved = useIssueMarkConfirmed()

  const onSplitConfirm = async (shares: Share[]) => {
    const selfOrg =
      pledges.data?.items && pledges.data?.items.length > 0
        ? pledges.data?.items[0].issue.repository.organization
        : undefined

    if (!selfOrg) {
      console.error('no pledge organization  found')
      return
    }

    const issue =
      pledges.data?.items &&
      pledges.data?.items.length > 0 &&
      pledges.data?.items[0].issue
    if (!issue) {
      console.error('no pledge issue found')
      return
    }

    const splits: ConfirmIssueSplit[] = shares
      .filter((s) => s.share_thousands !== undefined && s.share_thousands > 0)
      .map((s) => {
        // reward to self org
        if (s.id === organization?.id) {
          return {
            organization_id: s.id,
            share_thousands: s.share_thousands || 0,
          }
        }

        // reward to other
        return {
          github_username: s.username,
          share_thousands: s.share_thousands || 0,
        }
      })

    await markSolved.mutateAsync({
      id: issue.id,
      splits,
    })

    // have external rewards
    const haveExternalRewards =
      splits.filter((s) => !!s.github_username).length > 0

    if (haveExternalRewards) {
      setShowNotifyScreen(true)
      setNotifySplits(splits)
    } else {
      props.onClose()
    }
  }

  const selfOrgContributors: Contributor[] = organization
    ? [
        {
          id: organization.id,
          username: organization.name,
          avatar_url: organization.avatar_url,
          is_maintainer_org: true,
        },
      ]
    : []

  const pullRequestContributors: Contributor[] = pulls.data?.items
    ? pulls.data.items
        .map((pr) => pr.author)
        .filter((a): a is Author => !!a)
        .map((a) => {
          return {
            id: a.id.toString(),
            username: a.login,
            avatar_url: a.avatar_url,
            is_suggested_from_contributions: true,
          }
        })
    : []

  const contributors: Contributor[] = [
    ...selfOrgContributors,
    ...pullRequestContributors,
  ]

  const tmpShares: Share[] = contributors.map((c) => {
    return {
      id: c.id,
      username: c.username,
    }
  })

  // deduplicate
  const shares: Share[] = [
    ...new Map(tmpShares.map((item) => [item.username, item])).values(),
  ]

  if (!pledges.isFetched || !pulls.isFetched) {
    return <Spinner />
  }

  if (currentUser && issue && showNotifyScreen) {
    return (
      <SplitNotify
        pledges={pledges.data?.items || []}
        splits={notifySplits}
        user={currentUser}
        onCancel={props.onClose}
        issue={issue}
      />
    )
  }

  if (issue && organization && pledges.data?.items) {
    return (
      <>
        <Split
          issue={issue}
          organization={organization}
          pledges={pledges.data?.items || []}
          shares={shares}
          contributors={contributors}
          onConfirm={onSplitConfirm}
          onCancel={props.onClose}
        />
      </>
    )
  }

  return <Spinner />
}

export default SplitRewardModal
