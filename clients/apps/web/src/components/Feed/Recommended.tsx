'use client'

import Link from 'next/link'
import { ShadowBoxOnLg } from 'polarkit/components/ui/atoms'
import { useListForYouIssues } from 'polarkit/hooks'
import IssueListItem from '../Dashboard/IssueListItem'

const Recommended = () => {
  const issues = useListForYouIssues()

  return (
    <>
      <ShadowBoxOnLg>
        <>
          <div className="space-y-2 pb-4">
            <h1 className="dark:text-polar-50 text-lg text-gray-900">
              Recommended issues
            </h1>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              Based on repositories that you&apos;ve starred and their
              popularity
            </p>
          </div>

          {issues.isLoading && (
            <div className="flex flex-col gap-2">
              <div className="dark:bg-polar-700 h-4 w-[300px] animate-pulse rounded-lg bg-gray-400"></div>
              <div className="dark:bg-polar-700 h-4 w-[500px] animate-pulse rounded-lg bg-gray-400"></div>
              <div className="dark:bg-polar-700 h-4 w-[350px] animate-pulse rounded-lg bg-gray-400"></div>
            </div>
          )}

          <div>
            {issues.data?.items?.map((issue) => (
              <IssueListItem
                issue={issue}
                references={[]}
                pledges={[]}
                key={issue.id}
                canAddRemovePolarLabel={false}
                showPledgeAction={true}
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
