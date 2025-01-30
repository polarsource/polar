import { TimeInterval } from '@polar-sh/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'

const getIntervalLabel = (interval: TimeInterval) => {
  switch (interval) {
    case TimeInterval.HOUR:
      return 'Hourly'
    case TimeInterval.DAY:
      return 'Daily'
    case TimeInterval.WEEK:
      return 'Weekly'
    case TimeInterval.MONTH:
      return 'Monthly'
    case TimeInterval.YEAR:
      return 'Yearly'
  }
}

interface IntervalPickerProps {
  interval: TimeInterval
  onChange: (interval: TimeInterval) => void
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
        {Object.values(TimeInterval).map((interval) => (
          <SelectItem value={interval} key={interval} className="font-medium">
            {getIntervalLabel(interval)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default IntervalPicker
