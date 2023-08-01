import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useRouter } from 'next/router'
import { IssueSortBy } from 'polarkit/api/client'
import { Checkbox } from 'polarkit/components/ui'
import { ChangeEvent, FormEvent } from 'react'
import { DashboardFilters, navigate } from './filters'

const Search = (props: {
  filters: DashboardFilters
  onSetFilters: (f: DashboardFilters) => void
}) => {
  const { filters, onSetFilters } = props
  const router = useRouter()

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
      statusClosed: false,
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

  return (
    <div className="flex w-full flex-col space-y-3">
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
              className="block w-full rounded-lg border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 sm:text-sm sm:leading-6"
              placeholder="Search issues"
              onChange={onQueryChange}
              value={filters.q || ''}
            />
          </div>
        </div>

        {false && (
          <>
            <div className="flex items-center justify-between">
              <div className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </div>
              <div
                className="cursor-pointer text-xs font-medium text-blue-500 dark:text-blue-600"
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
                id="statusClosed"
                value={filters.statusClosed}
                onChange={onStatusChange}
              >
                Closed
              </Checkbox>
            </div>
            <div className="flex items-center justify-between">
              <div className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                Filters
              </div>
              <div
                className="cursor-pointer text-xs font-medium text-blue-500 dark:text-blue-600"
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
          </>
        )}
      </form>
    </div>
  )
}
export default Search
