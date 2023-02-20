import {
  CreditCardIcon,
  CogIcon,
  ArrowLeftOnRectangleIcon,
  PlusSmallIcon,
} from '@heroicons/react/20/solid'
import { Transition, Menu } from '@headlessui/react'
import { Fragment } from 'react'
import { useAuth } from 'context/auth'
import { classNames } from 'utils/dom'

const Profile = () => {
  const { session } = useAuth()

  if (!session.authenticated) {
    // TODO: Switch to <Link> or can we use that even in Dashboard (pure React)?
    return <a href="/login">Login</a>
  }

  return (
    <>
      <div className="flex items-center">
        <Menu as="div" className="relative inline-block text-left">
          <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
            <span className="sr-only">Open user menu</span>
            <img
              className="h-8 w-8 rounded-full"
              src={session.user.profile.avatar_url}
              alt=""
            />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                {session.user.profile.organizations &&
                  session.user.profile.organizations.map((organization) => {
                    return (
                      <Menu.Item key={organization.id}>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(
                              active
                                ? 'bg-gray-100 text-gray-900'
                                : 'text-gray-700',
                              'group flex items-center px-4 py-2 text-sm',
                            )}
                          >
                            <img
                              className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                              src={organization.avatar_url}
                              aria-hidden="true"
                            />
                            {organization.name}
                          </a>
                        )}
                      </Menu.Item>
                    )
                  })}

                <Menu.Item key="foobar">
                  {({ active }) => (
                    // TODO: Update this to be a variable instead of hardcoded link
                    <a
                      href="https://github.com/apps/polar-code/installations/new"
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-500',
                        'group flex items-center px-4 py-2 text-xs',
                      )}
                    >
                      <PlusSmallIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                      Add organization
                    </a>
                  )}
                </Menu.Item>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="#"
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'group flex items-center px-4 py-2 text-sm',
                      )}
                    >
                      <CreditCardIcon
                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                        aria-hidden="true"
                      />
                      Billing
                    </a>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="#"
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'group flex items-center px-4 py-2 text-sm',
                      )}
                    >
                      <CogIcon
                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                        aria-hidden="true"
                      />
                      Settings
                    </a>
                  )}
                </Menu.Item>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        session.signout()
                      }}
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'group flex items-center px-4 py-2 text-sm',
                      )}
                    >
                      <ArrowLeftOnRectangleIcon
                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                        aria-hidden="true"
                      />
                      Sign Out
                    </a>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </>
  )
}

export default Profile
