import IconCounter from "./IconCounter"
import Label from "./Label"
import { type IssueSchema } from "polarkit/api/client/IssueSchema"

const IssueListItem = (props: { issue: IssueSchema }) => {
    const { title, number, organization_name, repository_name } = props.issue
    const href = `https://github.com/${organization_name}/${repository_name}/issues/${number}`
    return (
        <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4">
                    <a className="font-medium" href={href}>{title}</a>
                    <div className="flex items-center gap-2">
                        <Label />
                        <Label />
                    </div>
                </div>
                <p className="text-gray-500 text-sm">#{number} opened 21 days ago</p>
            </div>
            <div className="flex items-center gap-6">
                <IconCounter icon="💬" count={3} />
                <IconCounter icon="👍" count={18} />
            </div>
        </div>
    )
}

export default IssueListItem
