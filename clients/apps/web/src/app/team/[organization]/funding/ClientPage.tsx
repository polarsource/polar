'use client'

import IssueListItem from '@/components/Dashboard/IssueListItem'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Pledge } from '@polar-sh/sdk'

import { useSearchPledges } from 'polarkit/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

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

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div>
        {openIssues.length > 0 ? (
          <h2 className="text-lg">Open issues</h2>
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
          <h2 className="text-lg">Closed issues</h2>
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
    </DashboardBody>
  )
}
