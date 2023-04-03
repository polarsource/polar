import { BellIcon } from '@heroicons/react/24/outline'
import { useNotifications } from 'polarkit/hooks'
import { useState } from 'react'

const Popover = () => {
  const [show, setShow] = useState(true)

  const clickBell = () => {
    setShow(!show)
  }

  const notifs = useNotifications()

  return (
    <>
      <div className="flex">
        <BellIcon
          className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
          aria-hidden="true"
          onClick={clickBell}
        />
        <div className="-ml-3 h-3 w-3 rounded-full border-2 border-white bg-[#9171D9]"></div>
      </div>

      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 top-6 flex items-end px-4 py-6 sm:items-start sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {show && (
            <>
              <div className="mr-8 -mb-7 h-6 w-6 rotate-45 border-t-[1px] border-l-[1px] border-black/5 bg-white"></div>
              <div className="w-full max-w-md">
                <div className="pointer-events-auto w-full  overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                  {JSON.stringify(notifs.data)}

                  <PledgePayout />
                  <PledgePayout />
                  <PledgePayout />
                  <PledgePayout />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Popover

const Item = ({
  title,
  children,
}: {
  title: string
  children: React.ReactElement
}) => {
  return (
    <div className="flex space-x-4 p-4">
      <div className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#F9E18F]">
        {children}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-black/50">Yesterday</div>
      </div>
    </div>
  )
}

const PledgePayout = () => {
  return (
    <Item title="$150 paid out for issue #1233">
      <DollarSignIcon />
    </Item>
  )
}

const DollarSignIcon = () => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.8">
        <path
          d="M9 0.75V17.25"
          stroke="#8F6700"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.75 3.75H7.125C6.42881 3.75 5.76113 4.02656 5.26884 4.51884C4.77656 5.01113 4.5 5.67881 4.5 6.375C4.5 7.07119 4.77656 7.73887 5.26884 8.23116C5.76113 8.72344 6.42881 9 7.125 9H10.875C11.5712 9 12.2389 9.27656 12.7312 9.76885C13.2234 10.2611 13.5 10.9288 13.5 11.625C13.5 12.3212 13.2234 12.9889 12.7312 13.4812C12.2389 13.9734 11.5712 14.25 10.875 14.25H4.5"
          stroke="#8F6700"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
