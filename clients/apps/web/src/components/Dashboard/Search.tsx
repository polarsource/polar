import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { DashboardFilters } from 'dashboard/filters'
import { IssueListType, IssueSortBy } from 'polarkit/api/client'
import { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react'
import Checkbox from './Checkbox'
import Tab from './Tab'
import Tabs from './Tabs'

const Search = (props: {
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters, onSetFilters } = props

  const onTabChange = (tab: IssueListType) => {
    onSetFilters({ ...filters, tab })
  }

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    // if not set, set to relevance
    const sort = filters.sort || IssueSortBy.RELEVANCE
    onSetFilters({ ...filters, q: event.target.value, sort })
  }

  const onStatusChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const id = event.target.id
    let f = { ...filters }
    f[id] = event.target.checked
    onSetFilters(f)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  const resetStatus = () => {
    onSetFilters({
      ...filters,
      statusBacklog: true,
      statusBuild: true,
      statusPullRequest: true,
      statusCompleted: false,
    })
  }

  return (
    <div className="flex w-full flex-col space-y-2">
      <Tabs>
        <Tab
          active={filters.tab === IssueListType.ISSUES}
          onClick={() => onTabChange(IssueListType.ISSUES)}
        >
          Issues
        </Tab>
        <Tab active={false}>Contributing</Tab>
        <Tab
          active={filters.tab === IssueListType.FOLLOWING}
          onClick={() => onTabChange(IssueListType.FOLLOWING)}
        >
          Following
        </Tab>
      </Tabs>
      <form className="space-y-2" onSubmit={onSubmit}>
        <div>
          <div className="relative mt-2 rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              name="query"
              id="query"
              className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#9171D9] sm:text-sm sm:leading-6"
              placeholder="Search issues"
              onChange={onQueryChange}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-md text-black/50">Status</div>
          <div
            className="cursor-pointer text-sm text-[#5824D9]/70"
            onClick={resetStatus}
          >
            Reset
          </div>
        </div>
        <div className="space-y-2">
          <Checkbox
            id="statusBacklog"
            value={filters.statusBacklog}
            onChange={onStatusChange}
          >
            Backlog
          </Checkbox>
          <Checkbox
            id="statusBuild"
            value={filters.statusBuild}
            onChange={onStatusChange}
          >
            Build
          </Checkbox>
          <Checkbox
            id="statusPullRequest"
            value={filters.statusPullRequest}
            onChange={onStatusChange}
          >
            Pull request
          </Checkbox>
          <Checkbox
            id="statusCompleted"
            value={filters.statusCompleted}
            onChange={onStatusChange}
          >
            Completed
          </Checkbox>
        </div>
      </form>
    </div>
  )
}
export default Search
