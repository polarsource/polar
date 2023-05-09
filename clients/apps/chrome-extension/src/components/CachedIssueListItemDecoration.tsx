import { IssueExtensionRead } from 'polarkit/api/client'
import { IssueListItemDecoration } from 'polarkit/components/Issue'
import Frame, { FrameContextConsumer } from 'react-frame-component'
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
      <Frame
        head={[
          <link
            type="text/css"
            rel="stylesheet"
            href={chrome.runtime.getURL('frame.css')}
          ></link>,
        ]}
      >
        <FrameContextConsumer>
          {({ document, window }) => {
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
          }}
        </FrameContextConsumer>
      </Frame>
    )
  } else {
    return null
  }
}

export default CachedIssueListItemDecoration
