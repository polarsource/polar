import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const BrowserPoll = (props: { options: string[] }) => {
  const [clicked, setClicked] = useState<string>()

  return (
    <div className="dark:bg-polar-700 my-2 flex flex-col space-y-2 bg-blue-300 p-8">
      {props.options.map((s) => (
        <div
          key={s}
          className={twMerge(
            'item-center flex cursor-pointer justify-between bg-black/20 p-2',
            clicked === s ? 'bg-green-300 dark:bg-blue-800' : '',
          )}
          onClick={() => setClicked(s)}
        >
          <div>{s}</div>
          <div>123 votes (10%)</div>
        </div>
      ))}
    </div>
  )
}

export default BrowserPoll
