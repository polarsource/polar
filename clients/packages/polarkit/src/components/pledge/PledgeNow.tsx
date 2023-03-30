import { useState, type MouseEvent } from 'react'
import Overlay from './Overlay'

const PledgeNow = () => {
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
      {open && <Overlay />}
    </>
  )
}

export default PledgeNow
