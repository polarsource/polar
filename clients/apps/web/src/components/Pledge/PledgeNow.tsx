import {
  IssueRead,
  OrganizationRead,
  RepositoryRead,
} from 'polarkit/api/client'
import { useState, type MouseEvent } from 'react'
import Overlay from './Overlay'

const PledgeNow = ({
  issue,
  org,
  repo,
}: {
  issue: IssueRead
  org: OrganizationRead
  repo: RepositoryRead
}) => {
  const [open, setOpen] = useState(false)

  const openOverlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setOpen(true)
  }

  return (
    <>
      <button
        className="w-full cursor-pointer rounded-lg bg-blue-600 px-2 py-1 text-sm font-medium text-gray-100 transition-colors duration-200 hover:bg-blue-500"
        onClick={openOverlay}
      >
        Pledge
      </button>
      {open && (
        <Overlay
          onClose={() => setOpen(false)}
          issue={issue}
          issueOrg={org}
          issueRepo={repo}
        />
      )}
    </>
  )
}

export default PledgeNow
