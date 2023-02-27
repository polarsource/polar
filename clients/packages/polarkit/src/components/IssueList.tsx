import IssueListItem from "./IssueListItem"
import { type IssueSchema } from "polarkit/api/client/IssueSchema"

const IssueList = (props: { issues: IssueSchema[] }) => {
    const issues = props.issues

    if (!issues) return <div>Loading...</div>

    return (
        <div className="space-y-2 divide-y divide-gray-200">
            {props.issues.map((issue) => {
                return <IssueListItem issue={issue} />
            })}
        </div>
    )
}

export default IssueList
