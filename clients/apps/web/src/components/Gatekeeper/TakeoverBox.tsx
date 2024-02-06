import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const TakeoverBox = (props: {
  fadeOut: boolean
  children: React.ReactElement
}) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (props.fadeOut) {
      setShow(false)
    } else {
      setShow(true)
    }
  }, [setShow, props.fadeOut])

  return (
    <div
      className={twMerge(
        'flex h-screen items-center justify-center transition duration-500 ease-in-out',
        show ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
      )}
    >
      <div className="mx-4 w-full md:mx-0 md:w-auto md:min-w-[700px]">
        <div className="flex flex-col space-y-8">{props.children}</div>
      </div>
    </div>
  )
}

export default TakeoverBox
