import { enums, schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

const getIntervalLabel = (interval: schemas['TimeInterval']) => {
  switch (interval) {
    case 'hour':
      return 'Hourly'
    case 'day':
      return 'Daily'
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'year':
      return 'Yearly'
  }
}

interface IntervalPickerProps {
  interval: schemas['TimeInterval']
  onChange: (interval: schemas['TimeInterval']) => void
}

const IntervalPicker: React.FC<IntervalPickerProps> = ({
  interval,
  onChange,
}) => {
  return (
    <Select value={interval} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select an interval" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(enums.timeIntervalValues).map((interval) => (
          <SelectItem value={interval} key={interval} className="font-medium">
            {getIntervalLabel(interval)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default IntervalPicker
