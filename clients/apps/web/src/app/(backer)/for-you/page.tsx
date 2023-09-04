'use client'

import IssueListItem from '@/components/Dashboard/IssueListItem'
import Spinner from '@/components/Shared/Spinner'
import { useAuth } from '@/hooks'
import { useListForYouIssues } from 'polarkit/hooks'

export default function Page() {
  const { currentUser } = useAuth()

  const issues = useListForYouIssues()

  return (
    <div className="mt-2 space-y-5">
      {issues.isLoading && <Spinner />}

      {issues.data?.items?.map((issue) => (
        <IssueListItem
          issue={issue}
          references={[]}
          dependents={undefined}
          pledges={[]}
          org={issue.repository.organization}
          repo={issue.repository}
          key={issue.id}
          showIssueProgress={true}
          canAddRemovePolarLabel={false}
          showPledgeAction={true}
          showSelfPledgesFor={currentUser}
        />
      ))}
    </div>
  )
}
