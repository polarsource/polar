'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MeterPeriod } from './useMeterPeriods'

export const formatDay = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() && {
      year: 'numeric',
    }),
  })

const formatPeriod = ({ start, end, current }: MeterPeriod) =>
  `${formatDay(start)} – ${end ? formatDay(end) : 'Now'}${current ? ' · Current' : ''}`

export const MeterPeriodSelect = ({
  periods,
  selected,
  onSelect,
}: {
  periods: MeterPeriod[]
  selected: number
  onSelect: (index: number) => void
}) => (
  <Box width={240}>
    <Select
      value={String(selected)}
      onValueChange={(value) => onSelect(Number(value))}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {periods.map((period, index) => (
          <SelectItem key={period.start.toISOString()} value={String(index)}>
            {formatPeriod(period)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Box>
)
