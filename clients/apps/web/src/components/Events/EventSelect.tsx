import { useEventNames } from '@/hooks/queries/events'
import ShortTextOutlined from '@mui/icons-material/ShortTextOutlined'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'

const EventSelect: React.FC<
  React.ComponentProps<typeof Select> & {
    className?: string
    organizationId: string
    allOption?: boolean
  }
> = ({ organizationId, allOption, className, ...props }) => {
  const { data } = useEventNames(organizationId)
  const eventNames = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Select {...props}>
      <SelectTrigger className={className}>
        <div className="flex flex-row items-center gap-x-2">
          <ShortTextOutlined fontSize="inherit" />
          <SelectValue placeholder="Select an event" translate="no" />
        </div>
      </SelectTrigger>
      <SelectContent translate="no">
        {allOption && <SelectItem value="all"><div>All Events</div></SelectItem>}
        {eventNames.map((eventName) => (
          <SelectItem key={eventName.name} value={eventName.name}>
            <div>{eventName.name}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default EventSelect
