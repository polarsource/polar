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
      `issues_v2/${orgName}/${repoName}/${number}`,
    )

  if (isInitialStateResolved && value) {
    const height = getExpectedHeight({
      pledges: value.pledges,
      references: value.references,
    })

    // System dark mode
    const isSystemDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches

    const gitHubMode = document
      ?.querySelector(':root')
      ?.getAttribute('data-color-mode')

    const isDark =
      gitHubMode === 'dark' || (gitHubMode === 'auto' && isSystemDark)

    const darkAttr = isDark ? 'class="dark" style="color-scheme: dark;"' : ''

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
          background: 'transparent',
        }}
        initialContent={`<!DOCTYPE html><html ${darkAttr}><head></head><body><div></div></body></html>`}
      >
        <FrameContextConsumer>
          {({ document, window }) => {
            return (
              <div className="bg-blue-50 dark:bg-blue-500/20">
                {/* open all links in the parent frame */}
                <base target="_parent"></base>
                <IssueListItemDecoration
                  orgName={orgName}
                  repoName={repoName}
                  issueNumber={number}
                  pledges={value.pledges}
                  references={value.references}
                  showConfirmPledgeAction={false}
                  showDisputeAction={false}
                  onConfirmPledges={async () => {}}
                  onDispute={() => {}}
                  confirmPledgeIsLoading={false}
                  funding={{}}
                  issue={value.issue}
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
