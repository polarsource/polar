import IssueListItem from "./IssueListItem"
import { type IssueSchema } from "polarkit/api/client"

const lastTimestamp = (issue: IssueSchema) => {
    const timestamps = [
        new Date(issue.issue_created_at),
        new Date(issue.issue_closed_at),
        new Date(issue.issue_modified_at),
        // TODO: Latest comment, commit, etc.
    ]

    const sorted = timestamps
        .filter((d) => Boolean(d))
        .sort((a, b) => { return b.getTime() - a.getTime() })

    return sorted[0]
}

const IssueList = (props: { issues: IssueSchema[] }) => {
    const issues = props.issues
    if (!issues) return <div>Loading...</div>

    const sortByActivity = (a: IssueSchema, b: IssueSchema) => {
        const aDate = lastTimestamp(a)
        const bDate = lastTimestamp(b)
        return bDate.getTime() - aDate.getTime()
    }

    let sortedIssues = issues.sort(sortByActivity)

    return (
        <div className="space-y-2 divide-y divide-gray-200">
            {sortedIssues.map((issue) => {
                return <IssueListItem issue={issue} key={issue.id} />
            })}
        </div>
    )
}

export default IssueList
