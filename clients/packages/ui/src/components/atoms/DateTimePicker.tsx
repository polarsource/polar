import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { FormControl } from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Matcher } from 'react-day-picker'
import { twMerge } from 'tailwind-merge'

interface DatePickerProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled?: Matcher | Matcher[]
}

const DatePicker: React.FC<DatePickerProps> = (props) => {
  const { value, onChange: _onChange, disabled } = props
  const internalValue = useMemo(
    () => (value ? new Date(value as string) : undefined),
    [value],
  )

  const onChange = useCallback(
    (date: Date | undefined) => {
      const value = date ? date.toISOString() : ''
      _onChange(value)
    },
    [_onChange],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl className="flex">
          <Button
            variant={'outline'}
            className={twMerge(
              'h-10 w-full justify-start rounded-xl text-left font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            {internalValue ? (
              format(internalValue, 'PPP')
            ) : (
              <span>Pick a date</span>
            )}
            <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={internalValue}
          onSelect={onChange}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePicker
