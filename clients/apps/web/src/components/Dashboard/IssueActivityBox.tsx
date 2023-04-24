import { ReactNode } from 'react'

const IssueActivityBox = (props: { children: ReactNode }) => {
  return (
    <>
      <div className="mb-8 rounded-xl bg-white px-4 py-3 shadow">
        {props.children}
      </div>
    </>
  )
}

export default IssueActivityBox
