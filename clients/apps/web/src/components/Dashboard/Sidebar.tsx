import { DashboardFilters } from 'dashboard/filters'
import { Dispatch, SetStateAction } from 'react'
import Search from './Search'

const Sidebar = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters, onSetFilters } = props
  return (
    <>
      <div className="bg-gray-75 fixed mt-16 hidden min-h-full pb-16  md:inset-y-0 md:flex md:w-80 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-[#EDEDED]">
          <div className="flex flex-1 flex-col overflow-y-auto pt-6 pb-4">
            <div className="flex flex-shrink-0 items-center px-5">
              <Search filters={filters} onSetFilters={onSetFilters} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default Sidebar
