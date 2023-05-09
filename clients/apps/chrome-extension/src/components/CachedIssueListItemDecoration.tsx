import { IssueExtensionRead } from 'polarkit/api/client'
import {
  IssueListItemDecoration,
  getExpectedHeight,
} from 'polarkit/components/Issue'
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
    const height = getExpectedHeight({
      pledges: value.pledges,
      references: value.references,
    })

    return (
      <Frame
        head={[
          <link
            type="text/css"
            rel="stylesheet"
            href={chrome.runtime.getURL('frame.css')}
          ></link>,
        ]}
        style={{
          height,
          overflow: 'hidden',
          width: '100%',
          border: 'none',
          backgroundColor: '#F2F6FC', // bg-blue-50
        }}
      >
        <FrameContextConsumer>
          {({ document, window }) => {
            return (
              <div className="bg-blue-50">
                {/* open all links in the parent frame */}
                <base target="_parent"></base>
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
