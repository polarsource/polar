import {
  HomeIcon,
  FolderIcon,
  FireIcon,
  CalendarIcon,
  InboxIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { classNames } from 'utils/dom'
import { Transition } from '@headlessui/react'
import { useAuth } from 'context/auth'
import RepoFilter from './RepoFilter'
import Starred from './Starred'

const navigation = [
  { name: 'Dashboard', href: '#', icon: HomeIcon, current: true },
  { name: 'Issues', href: '#', icon: FireIcon, current: false },
  { name: 'Projects', href: '#', icon: FolderIcon, current: false },
  { name: 'Calendar', href: '#', icon: CalendarIcon, current: false },
  { name: 'Documents', href: '#', icon: InboxIcon, current: false },
  { name: 'Reports', href: '#', icon: ChartBarIcon, current: false },
]

const Sidebar = () => {
  const { session } = useAuth()
  if (!session.authenticated) {
    return ''
  }

  return (
    <Transition
      as="div"
      show={session.authenticated}
      enter="transition-all duration-600 delay-300"
      enterFrom="opacity-0 scale-75"
      enterTo="opacity-100 scale-100"
      leave="transition-all duration-600"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-75"
    >
      <div className="flex flex-col aut pt-5 w-48 text-left">
        <div className="mt-5 flex flex-1 flex-col">
          <RepoFilter />
          <nav className="flex-1 space-y-1 pb-4 mt-6">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={classNames(
                  item.current
                    ? 'bg-white text-gray-800'
                    : 'text-gray-400 hover:bg-slate-100',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                )}
              >
                <item.icon
                  className={classNames(
                    item.current ? 'text-slate-600' : 'text-slate-300',
                    'mr-3 h-6 w-6 flex-shrink-0',
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </a>
            ))}
          </nav>
          <Starred />
        </div>
      </div>
    </Transition>
  )
}

export default Sidebar
