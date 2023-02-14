import { Transition } from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { requireAuth } from 'context/auth'

const DashboardNavigation = () => {
  const { session } = requireAuth()

  return (
    <>
      <Transition
        as="div"
        appear={true}
        show={session.authenticated}
        enter="transition-all duration-100 delay-100"
        enterFrom="opacity-0 scale-75"
        enterTo="opacity-100 scale-100"
        leave="transition-all duration-100"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-75"
      >
        <div className="relative text-gray-300 focus-within:text-gray-400">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <input
            id="search"
            name="search"
            className="block w-full rounded-xl border border-transparen bg-opacity-25 py-2 pl-10 pr-3 leading-5 text-gray-600 placeholder-gray-300 focus:bg-white focus:text-gray-900 focus:placeholder-gray-400 focus:outline-none focus:ring-0 sm:text-sm"
            placeholder="Search"
            type="search"
          />
        </div>
      </Transition>
    </>
  )
}

export default DashboardNavigation
