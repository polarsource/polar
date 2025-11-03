import { OrganizationContext } from '@/providers/maintainerOrganization'
import { endOfToday, startOfDay } from 'date-fns'
import { parseAsIsoDateTime, useQueryState } from 'nuqs'
import { useContext } from 'react'

interface DateRangeProps {
  defaultStartDate?: Date
  defaultEndDate?: Date
}

export const useDateRange = ({
  defaultStartDate,
  defaultEndDate,
}: DateRangeProps = {}) => {
  const { organization } = useContext(OrganizationContext)
  const organizationCreatedAt = startOfDay(new Date(organization.created_at))

  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime.withDefault(defaultStartDate ?? organizationCreatedAt),
  )

  const [endDate, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime.withDefault(defaultEndDate ?? endOfToday()),
  )

  return { startDate, endDate, setStartDate, setEndDate }
}
