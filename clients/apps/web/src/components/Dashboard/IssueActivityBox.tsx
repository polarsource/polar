import { ReactNode } from 'react'

const IssueActivityBox = (props: { children: ReactNode }) => {
  return (
    <>
      <div className="mb-8 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-[0_0_15px_-5px_rgba(0,0,0,0.3)]">
        {props.children}
      </div>
    </>
  )
}

export default IssueActivityBox
