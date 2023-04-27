import { IssueExtensionRead } from 'polarkit/api/client'
import { IssueListItemDecoration } from 'polarkit/components/Issue'
import { useChromeStorageLocal } from 'use-chrome-storage'

/*
 * Render the issue list item decoration from chrome.storage or null if there is none.
 */
const CachedIssueListItemDecoration = ({
  orgName,
  repoName,
  number,
}: {
  orgName: string
  repoName: string
  number: number
}) => {
  const [value, setValue, isPersistent, error, isInitialStateResolved] =
    useChromeStorageLocal<IssueExtensionRead>(
      `issues/${orgName}/${repoName}/${number}`,
    )

  if (isInitialStateResolved && value) {
    return (
      <div className="bg-blue-50 px-3.5 py-2.5">
        <IssueListItemDecoration
          orgName={orgName}
          repoName={repoName}
          pledges={value.pledges}
          references={value.references}
        />
      </div>
    )
  } else {
    return null
  }
}

export default CachedIssueListItemDecoration
