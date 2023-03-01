import { ReactNode } from "react"

const IssueActivityBox = (props: { children: ReactNode }) => {
    return (<>
        <div className="bg-white shadow-lg rounded-xl p-4 mb-8 flex flex-col gap-2">
            {props.children}
        </div>
    </>
    )
}

export default IssueActivityBox
