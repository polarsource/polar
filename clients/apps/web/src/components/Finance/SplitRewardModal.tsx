import { useAuth } from '@/hooks'
import { Author, ConfirmIssueSplit } from 'polarkit/api/client'
import {
  useIssueMarkConfirmed,
  useListPledesForIssue,
  useListPullsReferencingIssue,
} from 'polarkit/hooks'
import { useState } from 'react'
import Spinner from '../Shared/Spinner'
import Split, { Contributor, Share } from './Split'
import SplitNotify from './SplitNotify'

const SplitRewardModal = (props: { issueId: string; onClose: () => void }) => {
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
        if (s.username === selfOrg.name) {
          return {
            organization_id: selfOrg.id,
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

  const selfOrgContributors: Contributor[] =
    pledges.data?.items &&
    pledges.data?.items.length > 0 &&
    pledges.data?.items[0].issue.repository.organization
      ? [
          {
            username: pledges.data?.items[0].issue.repository.organization.name,
            avatar_url:
              pledges.data?.items[0].issue.repository.organization.avatar_url,
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

  const issue = pledges.data?.items ? pledges.data?.items[0].issue : undefined

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

  if (issue && pledges.data?.items) {
    return (
      <>
        <Split
          issue={issue}
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
