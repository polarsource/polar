import IconCounter from "./IconCounter"
import { type IssueSchema } from "polarkit/api/client"
import IssueLabel from "./IssueLabel"
import ReactTimeAgo from 'react-time-ago'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'

TimeAgo.addDefaultLocale(en)

const IssueListItem = (props: { issue: IssueSchema }) => {
    const { title, number, organization_name, repository_name, state, issue_created_at, issue_closed_at } = props.issue
    const href = `https://github.com/${organization_name}/${repository_name}/issues/${number}`
    const createdAt = new Date(issue_created_at)
    const closedAt = new Date(issue_created_at)

    return (
        <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <div className="flex items-start gap-4">
                    <a className="font-medium" href={href}>{title}</a>
                    <div className="flex items-center gap-2">
                        {props.issue.labels && props.issue.labels.map((label) => {
                            return <IssueLabel label={label} key={label.id} />
                        })}

                    </div>
                </div>
                <div>
                    {state == "open" && <p className="text-gray-500 text-sm">#{number} opened <ReactTimeAgo date={createdAt} /></p>}
                    {state == "closed" && <p className="text-gray-500 text-sm">#{number} closed <ReactTimeAgo date={closedAt} /></p>}
                </div>
            </div>
            <div className="flex items-center gap-6">
                <IconCounter icon="💬" count={3} />
                <IconCounter icon="👍" count={18} />
            </div>
        </div>
    )
}

export default IssueListItem
