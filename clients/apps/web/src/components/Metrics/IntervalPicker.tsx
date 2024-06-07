import { Interval } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'

const getIntervalLabel = (interval: Interval) => {
  switch (interval) {
    case Interval.HOUR:
      return 'Hourly'
    case Interval.DAY:
      return 'Daily'
    case Interval.WEEK:
      return 'Weekly'
    case Interval.MONTH:
      return 'Monthly'
    case Interval.YEAR:
      return 'Yearly'
  }
}

interface IntervalPickerProps {
  interval: Interval
  onChange: (interval: Interval) => void
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
        {Object.values(Interval).map((interval) => (
          <SelectItem value={interval} key={interval} className="font-medium">
            {getIntervalLabel(interval)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default IntervalPicker
