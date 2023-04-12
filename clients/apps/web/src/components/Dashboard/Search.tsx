import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { DashboardFilters } from 'dashboard/filters'
import { useRouter } from 'next/router'
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
    const f = { ...filters, tab }
    onSetFilters(f)
    navigate(f)
  }

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    // if not set, set to relevance
    const sort = filters.sort || IssueSortBy.RELEVANCE
    const f = { ...filters, q: event.target.value, sort }
    onSetFilters(f)

    navigate(f)
  }

  const onStatusChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()

    const id = event.target.id
    let f = { ...filters }
    f[id] = event.target.checked
    onSetFilters(f)
    navigate(f)
  }

  const navigate = (filters: DashboardFilters) => {
    const params = new URLSearchParams()

    const statuses = []
    if (filters.statusBacklog) {
      statuses.push('backlog')
    }
    if (filters.statusBuild) {
      statuses.push('build')
    }
    if (filters.statusPullRequest) {
      statuses.push('pull_request')
    }
    if (filters.statusCompleted) {
      statuses.push('completed')
    }

    params.set('statuses', statuses.join(','))

    if (filters.q) {
      params.set('q', filters.q)
    }
    if (filters.tab) {
      params.set('tab', filters.tab)
    }
    if (filters.sort) {
      params.set('sort', filters.sort)
    }

    const url = new URL(window.location.href)
    const newPath = `${url.pathname}?${params.toString()}`
    router.push(url.pathname, newPath)
  }

  const router = useRouter()

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(filters)
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
    <div className="flex w-full flex-col space-y-3">
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
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <div className="relative mt-2 rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-gray-500"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              name="query"
              id="query"
              className="block w-full rounded-lg border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
              placeholder="Search issues"
              onChange={onQueryChange}
              value={filters.q || ''}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="mt-1 text-sm font-medium text-gray-500">Status</div>
          <div
            className="cursor-pointer text-xs font-medium text-blue-500"
            onClick={resetStatus}
          >
            Reset
          </div>
        </div>
        <div className="space-y-3">
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
