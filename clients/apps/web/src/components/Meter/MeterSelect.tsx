import { useMeters } from '@/hooks/queries/meters'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

const MeterSelect: React.FC<
  React.ComponentProps<typeof Select> & {
    className?: string
    organizationId: string
    allOption?: boolean
  }
> = ({ organizationId, allOption, className, ...props }) => {
  const { data } = useMeters(organizationId, {
    sorting: ['name'],
    is_archived: false,
  })
  const meters = data?.items ?? []

  return (
    <Select {...props}>
      <SelectTrigger className={className}>
        <div className="flex flex-row items-center gap-x-2">
          <DonutLargeOutlined fontSize="inherit" />
          <SelectValue placeholder="Select a meter" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {allOption && <SelectItem value="all">All Meters</SelectItem>}
        {meters.map((meter) => (
          <SelectItem key={meter.id} value={meter.id}>
            {meter.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default MeterSelect
