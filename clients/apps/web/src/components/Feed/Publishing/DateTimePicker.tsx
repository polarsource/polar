import { CalendarIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { Calendar } from 'polarkit/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'polarkit/components/ui/popover'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface DateTimePickerProps {
  date: Date | undefined
  onChange: (v: Date) => void
  canSelectFuture: boolean
  canSelectPast: boolean
}

type Time = { hour?: number; min?: number }

export const DateTimePicker = ({
  date,
  onChange,
  canSelectFuture,
  canSelectPast,
}: DateTimePickerProps) => {
  const [datePickerDate, setDatePickerDate] = useState<Date>(date || new Date())

  const [time, setTime] = useState<Time>({
    hour: 0,
    min: 0,
  })

  useEffect(() => {
    setDatePickerDate(date || new Date())
    setTime({
      hour: date ? date.getHours() : 0,
      min: date ? date.getMinutes() : 0,
    })
  }, [date])

  const changed = (date: Date, time: Time) => {
    let d = new Date()

    d.setFullYear(date.getFullYear())
    d.setMonth(date.getMonth())
    d.setDate(date.getDate())
    d.setHours(time.hour || 0)
    d.setMinutes(time.min || 0)
    d.setSeconds(0)
    d.setMilliseconds(0)

    onChange(d)
  }

  const onChangeDate = (v?: Date) => {
    if (!v) {
      v = new Date()
    }
    setDatePickerDate(v)
    changed(v || new Date(), time)
  }

  const onChangeTime = (v: Time) => {
    setTime(v)
    changed(datePickerDate || new Date(), v)
  }

  return (
    <div className="flex items-center gap-4 ">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className={twMerge(
              'w-[280px] justify-start text-left font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            toDate={!canSelectFuture ? new Date() : undefined}
            fromDate={!canSelectPast ? new Date() : undefined}
            classNames={{
              day_today: 'bg-gray-200 dark:bg-gray-800',
              cell: 'h-9 w-9 text-center text-sm p-0 relative rounded-md focus-within:relative focus-within:z-20',
            }}
            mode="single"
            selected={date}
            onSelect={onChangeDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-sm">at</span>

      <div className="flex items-center gap-1 text-sm">
        <Input
          className="w-[80px]"
          type="number"
          min={0}
          max={23}
          value={time.hour}
          onChange={(e) => {
            const h = parseInt(e.target.value)
            const hour =
              !isNaN(h) && isFinite(h)
                ? Math.max(0, Math.min(23, h))
                : undefined

            const n = {
              ...time,
              hour,
            }
            onChangeTime(n)
          }}
        />
        <span>:</span>
        <Input
          className="w-[80px]"
          type="number"
          min={0}
          max={59}
          value={time.min}
          onChange={(e) => {
            const m = parseInt(e.target.value)
            const minute =
              !isNaN(m) && isFinite(m)
                ? Math.max(0, Math.min(59, m))
                : undefined

            const n = {
              ...time,
              min: minute,
            }
            onChangeTime(n)
          }}
        />
      </div>
    </div>
  )
}
