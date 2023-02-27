import IssueListItem from "./IssueListItem"
import { type IssueSchema } from "polarkit/api/client"

const IssueList = (props: { issues: IssueSchema[] }) => {
    const issues = props.issues
    if (!issues) return <div>Loading...</div>
    return (
        <div className="space-y-2 divide-y divide-gray-200">
            {props.issues.map((issue) => {
                return <IssueListItem issue={issue} key={issue.id} />
            })}
        </div>
    )
}

export default IssueList
