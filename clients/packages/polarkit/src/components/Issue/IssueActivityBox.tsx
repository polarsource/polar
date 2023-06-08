import { ReactNode } from 'react'

const IssueActivityBox = (props: { children: ReactNode }) => {
  return (
    <>
      <div className="relative mb-8">
        <div className="absolute -top-3 left-6 inline-block overflow-hidden">
          <div className="h-3 w-4 origin-bottom-left rotate-45 transform bg-white shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700"></div>
        </div>
        <div className="overflow-hidden rounded-xl bg-white shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
          {props.children}
        </div>
      </div>
    </>
  )
}

export default IssueActivityBox
