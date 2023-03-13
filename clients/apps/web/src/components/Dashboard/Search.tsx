import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import Checkbox from './Checkbox'
import Tab from './Tab'
import Tabs from './Tabs'

const Search = () => {
  return (
    <div className="flex w-full flex-col space-y-2">
      <Tabs>
        <Tab active={true}>Issues</Tab>
        <Tab active={false}>Contributing</Tab>
        <Tab active={false}>Following</Tab>
      </Tabs>
      <form className="space-y-2">
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
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-md text-black/50">Status</div>
          <div className="text-sm text-[#5824D9]/70">Reset</div>
        </div>
        <div className="space-y-2">
          <Checkbox id="backlog">Backlog</Checkbox>
          <Checkbox id="build">Build</Checkbox>
          <Checkbox id="pull_request">Pull request</Checkbox>
          <Checkbox id="completed">Completed</Checkbox>
        </div>
      </form>
    </div>
  )
}
export default Search
