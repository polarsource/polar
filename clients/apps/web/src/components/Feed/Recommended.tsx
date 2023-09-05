'use client'

import { useAuth } from '@/hooks'
import Link from 'next/link'
import { useListForYouIssues } from 'polarkit/hooks'
import IssueListItem from '../Dashboard/IssueListItem'

const Recommended = () => {
  const issues = useListForYouIssues()
  const { currentUser } = useAuth()

  if (issues.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="h-4 w-[300px] animate-pulse rounded-lg bg-gray-400"></div>
        <div className="h-4 w-[500px] animate-pulse rounded-lg bg-gray-400"></div>
        <div className="h-4 w-[350px] animate-pulse rounded-lg bg-gray-400"></div>
      </div>
    )
  }

  return (
    <>
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
          recommendedReason={'starred'}
          right={
            <>
              <Link
                href={`/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`}
                className="font-medium text-blue-600"
              >
                Pledge
              </Link>
            </>
          }
        />
      ))}
    </>
  )
}

export default Recommended
