import { ReactNode } from 'react'

const IssueActivityBox = (props: { children: ReactNode }) => {
  return (
    <>
      <div className="relative mb-2">
        <div className="absolute -top-3 left-8 inline-block overflow-hidden">
          <div className="dark:bg-polar-800 dark:ring-polar-700 h-3 w-4 origin-bottom-left rotate-45 transform bg-white shadow dark:ring-1"></div>
        </div>
        <div className="dark:bg-polar-800 dark:ring-polar-700 overflow-hidden rounded-xl bg-white shadow dark:ring-1">
          {props.children}
        </div>
      </div>
    </>
  )
}

export default IssueActivityBox
