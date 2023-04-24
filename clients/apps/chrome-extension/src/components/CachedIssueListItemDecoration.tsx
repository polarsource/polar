import { IssueExtensionRead } from 'polarkit/api/client'
import { IssueListItemDecoration } from 'polarkit/components'
import { useChromeStorageLocal } from 'use-chrome-storage'

// The typing is a bit weird, so we need to provide an "empty" initial value of the correct type
const initialValue: IssueExtensionRead = {
  number: -1,
  pledges: [],
  references: [],
}

/*
 * Render the issue list item decoration from chrome.storage.
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
    useChromeStorageLocal(
      `issues/${orgName}/${repoName}/${number}`,
      initialValue,
    )

  if (isInitialStateResolved) {
    return (
      <IssueListItemDecoration
        orgName={orgName}
        repoName={repoName}
        pledges={value.pledges}
        references={value.references}
      />
    )
  } else {
    return null
  }
}

export default CachedIssueListItemDecoration
