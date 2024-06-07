'use client'

import { useListForYouIssues } from '@/hooks/queries'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import IssueListItem from '../Issues/IssueListItem'

const Recommended = () => {
  const issues = useListForYouIssues()

  return (
    <>
      <ShadowBoxOnMd>
        <>
          <div className="space-y-2 pb-4">
            <h1 className="text-lg text-gray-900 dark:text-white">
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
              />
            ))}
          </div>
        </>
      </ShadowBoxOnMd>
    </>
  )
}

export default Recommended
