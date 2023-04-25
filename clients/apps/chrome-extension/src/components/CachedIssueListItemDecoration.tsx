import { IssueExtensionRead } from 'polarkit/api/client'
import { IssueListItemDecoration } from 'polarkit/components'
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
    useChromeStorageLocal(`issues/${orgName}/${repoName}/${number}`)

  // The type of value is wrong, so we need to cast the value to the correct type
  const typedValue = value as IssueExtensionRead | undefined

  if (isInitialStateResolved && typedValue) {
    return (
      <IssueListItemDecoration
        orgName={orgName}
        repoName={repoName}
        pledges={typedValue.pledges}
        references={typedValue.references}
      />
    )
  } else {
    return null
  }
}

export default CachedIssueListItemDecoration
