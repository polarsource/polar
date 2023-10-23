'use client'

import IssueListItem from '@/components/Dashboard/IssueListItem'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentTeamFromURL } from '@/hooks/org'
import { HowToVoteOutlined } from '@mui/icons-material'
import { Pledge } from '@polar-sh/sdk'

import { useSearchPledges } from 'polarkit/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentTeamFromURL()

  const pledges = useSearchPledges({
    byOrganizationId: org?.id,
  })

  const groupByIssue = (pledges: Pledge[]): Record<string, Pledge[]> => {
    let ret: Record<string, Pledge[]> = {}

    for (const p of pledges) {
      if (ret[p.issue.id]) {
        // const ext = [...ret[p.issue.id]]
        // TODO: authed_can_admin_sender here is a hack to get the page to render more pledge details
        ret[p.issue.id].push({ ...p, authed_can_admin_sender: true })
      } else {
        ret[p.issue.id] = [{ ...p, authed_can_admin_sender: true }]
      }
    }

    return ret
  }

  const openIssues =
    pledges.data?.items?.filter((p) => p.issue.state === 'OPEN') || []

  const closedIssues =
    pledges.data?.items?.filter((p) => p.issue.state === 'CLOSED') || []

  const groupedOpenIssues = groupByIssue(openIssues)

  const groupedClosedIssues = groupByIssue(closedIssues)

  const havePledges = (pledges.data?.items?.length || 0) > 0

  if (!isLoaded || !org) {
    return <Spinner />
  }

  return (
    <>
      {pledges.isFetched && !havePledges ? (
        <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-6 py-64 text-gray-400">
          <span className="text-6xl">
            <HowToVoteOutlined fontSize="inherit" />
          </span>
          <h2 className="text-lg">
            {org.name} hasn&apos;t funded any issues... yet!
          </h2>
        </div>
      ) : null}

      {havePledges ? (
        <div>
          <h2 className="text-2xl font-medium">Funding</h2>

          {openIssues.length > 0 ? (
            <h2 className="mt-2 text-lg">Open issues</h2>
          ) : null}

          {Object.values(groupedOpenIssues).map((ps) => (
            <IssueListItem
              key={ps[0].issue.id}
              issue={ps[0].issue}
              references={[]}
              pledges={ps}
              canAddRemovePolarLabel={false}
              showLogo={true}
              showPledgeAction={false}
            />
          ))}

          {closedIssues.length > 0 ? (
            <h2 className="mt-2 text-lg">Closed issues</h2>
          ) : null}

          {Object.values(groupedClosedIssues).map((ps) => (
            <IssueListItem
              key={ps[0].issue.id}
              issue={ps[0].issue}
              references={[]}
              pledges={ps}
              canAddRemovePolarLabel={false}
              showLogo={true}
              showPledgeAction={false}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
