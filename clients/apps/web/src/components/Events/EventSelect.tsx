import { useEventNames } from '@/hooks/queries/events'
import ShortTextOutlined from '@mui/icons-material/ShortTextOutlined'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

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
          <SelectValue placeholder="Select an event" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {allOption && <SelectItem value="all">All Events</SelectItem>}
        {eventNames.map((eventName) => (
          <SelectItem key={eventName.name} value={eventName.name}>
            {eventName.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default EventSelect
