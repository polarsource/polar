import { useState, type MouseEvent } from 'react'
import {
  IssueRead,
  OrganizationRead,
  RepositoryRead,
} from '../../api/client/index'
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
        className="cursor-pointer rounded-md bg-purple-500 px-2 py-1 text-white hover:bg-purple-400"
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
