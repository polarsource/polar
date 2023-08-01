import { DashboardFilters } from '@/components/Dashboard/filters'
import { Dispatch, SetStateAction } from 'react'
import Search from '../Dashboard/Search'

const DashboardIssuesFilterLayout = (props: {
  children: any
  filters: DashboardFilters
  isPersonalDashboard: boolean
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters, onSetFilters, children, isPersonalDashboard } = props

  return (
    <div className="">
      <div>
        <Search filters={filters} onSetFilters={onSetFilters} />

        <div>{children}</div>
      </div>
    </div>
  )
}

export default DashboardIssuesFilterLayout
