import IconCounter from "./IconCounter"
import Label from "./Label"

const IssueListItem = () => {
    return (
        <div className="py-4 flex items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="font-medium">Support MySQL DELETE...JOIN syntax</h2>
                    <Label />
                    <Label />
                </div>
                <p className="text-gray-500">#8150 opened 21 days ago</p>
            </div>
            <div className="flex items-center gap-4">
                <IconCounter icon="💬" count={3} />
                <IconCounter icon="👍" count={18} />
            </div>
        </div>
    )
}

export default IssueListItem
