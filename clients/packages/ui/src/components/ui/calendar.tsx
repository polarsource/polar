'use client'

import { ChevronLeft, ChevronRight } from '@polar-sh/orbit/icons'
import * as React from 'react'
import { DateRange, DayPicker } from 'react-day-picker'

import { buttonVariants } from '@polar-sh/orbit/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute top-0 right-0 left-0 h-0 z-10',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'absolute left-1',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'absolute right-1',
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'h-9 w-9 text-center text-sm p-0 relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-polar-700 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0',
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        today:
          '[&>button]:font-semibold [&:not([data-selected])>button]:text-primary',
        outside: 'text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        range_start: 'bg-primary/15 rounded-l-md last:rounded-r-md',
        range_end: 'bg-primary/15 rounded-r-md first:rounded-l-md',
        range_middle:
          'bg-primary/15 first:rounded-l-md last:rounded-r-md [&>button]:bg-transparent! [&>button]:text-inherit! [&>button]:hover:bg-primary/20!',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          if (props.orientation === 'left') {
            return (
              <ChevronLeft className={cn('h-4 w-4', className)} {...props} />
            )
          }

          return (
            <ChevronRight className={cn('h-4 w-4', className)} {...props} />
          )
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
export type { DateRange }
