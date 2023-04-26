import { ReactNode } from 'react'

const IssueActivityBox = (props: { children: ReactNode }) => {
  return (
    <>
      <div className="relative mb-8 rounded-xl bg-white px-4 py-3 shadow">
        <div className="absolute -top-3 left-6 inline-block overflow-hidden">
          <div className="h-3 w-4 origin-bottom-left rotate-45 transform bg-white shadow"></div>
        </div>
        {props.children}
      </div>
    </>
  )
}

export default IssueActivityBox
