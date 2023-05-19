import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useRouter } from 'next/router'
import { IssueListType, IssueSortBy } from 'polarkit/api/client'
import { Checkbox } from 'polarkit/components/ui'
import { ChangeEvent, FormEvent } from 'react'
import Tab from './Tab'
import Tabs from './Tabs'
import { DashboardFilters, navigate } from './filters'

const Search = (props: {
  filters: DashboardFilters
  showTabs: IssueListType[]
  onSetFilters: (f: DashboardFilters) => void
}) => {
  const { filters, onSetFilters, showTabs } = props
  const router = useRouter()

  const onTabChange = (tab: IssueListType) => {
    let sort = filters.sort
    if (tab === IssueListType.ISSUES) {
      sort = IssueSortBy.ISSUES_DEFAULT
    }
    if (tab === IssueListType.DEPENDENCIES) {
      sort = IssueSortBy.DEPENDENCIES_DEFAULT
    }

    const f: DashboardFilters = { ...filters, tab, sort }
    onSetFilters(f)
    navigate(router, f)
  }

  const onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault()
    event.stopPropagation()

    // if not set, set to relevance
    const sort = filters.sort || IssueSortBy.RELEVANCE
    const f: DashboardFilters = { ...filters, q: event.target.value, sort }
    onSetFilters(f)

    navigate(router, f)
  }

  const onStatusChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()

    type F = keyof DashboardFilters
    const id = event.target.id as F

    const f: DashboardFilters = {
      ...filters,
      [id]: event.target.checked,
    }

    onSetFilters(f)
    navigate(router, f)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(router, filters)
  }

  const resetStatus = () => {
    const f: DashboardFilters = {
      ...filters,
      statusBacklog: true,
      statusTriaged: true,
      statusInProgress: true,
      statusPullRequest: true,
      statusCompleted: false,
    }
    onSetFilters(f)
    navigate(router, f)
  }

  const resetFilters = () => {
    const f: DashboardFilters = {
      ...filters,
      onlyPledged: false,
    }
    onSetFilters(f)
    navigate(router, f)
  }

  const tabName = (tab: IssueListType): string => {
    switch (tab) {
      case IssueListType.ISSUES:
        return 'Issues'
      case IssueListType.DEPENDENCIES:
        return 'Dependencies'
    }
  }

  return (
    <div className="flex w-full flex-col space-y-3">
      {showTabs.length === 1 && (
        <h2 className="text-center text-gray-500">{tabName(showTabs[0])}</h2>
      )}

      {showTabs.length > 1 && (
        <Tabs>
          <>
            {showTabs.map((t) => {
              return (
                <Tab
                  key={t}
                  active={filters.tab === t}
                  onClick={() => onTabChange(t)}
                >
                  <>{tabName(t)}</>
                </Tab>
              )
            })}
          </>
        </Tabs>
      )}

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
            id="statusTriaged"
            value={filters.statusTriaged}
            onChange={onStatusChange}
          >
            Triaged
          </Checkbox>
          <Checkbox
            id="statusInProgress"
            value={filters.statusInProgress}
            onChange={onStatusChange}
          >
            In progress
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
        <div className="flex items-center justify-between">
          <div className="mt-1 text-sm font-medium text-gray-500">Filters</div>
          <div
            className="cursor-pointer text-xs font-medium text-blue-500"
            onClick={resetFilters}
          >
            Reset
          </div>
        </div>
        <div className="space-y-3">
          <Checkbox
            id="onlyPledged"
            value={filters.onlyPledged}
            onChange={onStatusChange}
          >
            Only Pledged
          </Checkbox>
        </div>
      </form>
    </div>
  )
}
export default Search
