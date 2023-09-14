import { ConfirmIssueSplit } from 'polarkit/api/client'
import { useIssueMarkConfirmed, useListPledesForIssue } from 'polarkit/hooks'
import Spinner from '../Shared/Spinner'
import Split, { Contributor, Share } from './Split'

const SplitRewardModal = (props: { issueId: string; onClose: () => void }) => {
  const pledges = useListPledesForIssue(props.issueId)

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

    props.onClose()
  }

  const shares: Share[] =
    pledges.data?.items &&
    pledges.data?.items.length > 0 &&
    pledges.data?.items[0].issue.repository.organization
      ? [
          {
            username: pledges.data?.items[0].issue.repository.organization.name,
          },
        ]
      : []

  const contributors: Contributor[] =
    pledges.data?.items &&
    pledges.data?.items.length > 0 &&
    pledges.data?.items[0].issue.repository.organization
      ? [
          {
            username: pledges.data?.items[0].issue.repository.organization.name,
            avatar_url:
              pledges.data?.items[0].issue.repository.organization.avatar_url,
          },
        ]
      : []

  if (!pledges.isFetched) {
    return <Spinner />
  }

  return (
    <Split
      pledges={pledges.data?.items || []}
      shares={shares}
      contributors={contributors}
      onConfirm={onSplitConfirm}
      onCancel={props.onClose}
    />
  )
}

export default SplitRewardModal
