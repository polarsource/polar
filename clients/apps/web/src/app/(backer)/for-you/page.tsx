'use client'

import IssueListItem from '@/components/Dashboard/IssueListItem'
import Spinner from '@/components/Shared/Spinner'
import { useAuth } from '@/hooks'
import { useListForYouIssues } from 'polarkit/hooks'
import { useFeatureFlagEnabled } from 'posthog-js/react'

export default function Page() {
  const { currentUser } = useAuth()

  const issues = useListForYouIssues()

  const enabled = useFeatureFlagEnabled('for-you-test')

  return (
    <div className="mt-2 space-y-5">
      {issues.isLoading && <Spinner />}

      {enabled && (
        <div className="bg-green-200">you&apos;re in the feature flag</div>
      )}
      {!enabled && (
        <div className="bg-red-200">you&apos;re not in the feature flag</div>
      )}

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
