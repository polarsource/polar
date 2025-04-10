import { useMeters } from '@/hooks/queries/meters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

const MeterSelect: React.FC<
  React.ComponentProps<typeof Select> & {
    organizationId: string
    allOption?: boolean
  }
> = ({ organizationId, allOption, ...props }) => {
  const { data } = useMeters(organizationId, { sorting: ['name'] })
  const meters = data?.items ?? []

  return (
    <Select {...props}>
      <SelectTrigger>
        <SelectValue placeholder="Select a meter" />
      </SelectTrigger>
      <SelectContent>
        {allOption && <SelectItem value="all">All meters</SelectItem>}
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
