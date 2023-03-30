import { IssueRead } from 'api/client/index'
import { useState, type MouseEvent } from 'react'
import Overlay from './Overlay'

const PledgeNow = ({ issue }: { issue: IssueRead }) => {
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
      {open && <Overlay onClose={() => setOpen(false)} issue={issue} />}
    </>
  )
}

export default PledgeNow
