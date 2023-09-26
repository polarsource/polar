'use client'

import { useAuth } from '@/hooks'
import Link from 'next/link'
import { ShadowBoxOnLg } from 'polarkit/components/ui'
import { useListForYouIssues } from 'polarkit/hooks'
import IssueListItem from '../Dashboard/IssueListItem'

const Recommended = () => {
  const issues = useListForYouIssues()
  const { currentUser } = useAuth()

  return (
    <>
      <ShadowBoxOnLg>
        <>
          <div className="space-y-2 pb-4">
            <h1 className="text-lg text-gray-900 dark:text-gray-300">
              Recommended issues
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Based on repositories that you&apos;ve starred and their
              popularity
            </p>
          </div>

          {issues.isLoading && (
            <div className="flex flex-col gap-2">
              <div className="h-4 w-[300px] animate-pulse rounded-lg bg-gray-400"></div>
              <div className="h-4 w-[500px] animate-pulse rounded-lg bg-gray-400"></div>
              <div className="h-4 w-[350px] animate-pulse rounded-lg bg-gray-400"></div>
            </div>
          )}

          <div className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800 ">
            {issues.data?.items?.map((issue) => (
              <IssueListItem
                issue={issue}
                references={[]}
                dependents={undefined}
                pledges={[]}
                org={issue.repository.organization}
                repo={issue.repository}
                key={issue.id}
                canAddRemovePolarLabel={false}
                showPledgeAction={true}
                showSelfPledgesFor={currentUser}
                showLogo={true}
                className="py-3"
                right={
                  <>
                    <Link
                      href={`/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`}
                      className="font-medium text-blue-600"
                    >
                      Fund
                    </Link>
                  </>
                }
              />
            ))}
          </div>
        </>
      </ShadowBoxOnLg>
    </>
  )
}

export default Recommended
