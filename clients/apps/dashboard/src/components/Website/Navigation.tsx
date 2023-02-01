import { Transition } from '@headlessui/react'
import { useAuth } from 'context/auth'

const WebsiteNavigation = () => {
  const { session } = useAuth()

  return (
    <>
      <Transition
        as="div"
        appear={true}
        show={!session.authenticated}
        enter="transition-opacity duration-500"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-all duration-500"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-75"
      >
        <ul className="flex flex-row text-sm font-medium h-10 items-center">
          <li className="mx-6">
            <a href="/about" className="py-0.5">
              About
            </a>
          </li>
          <li className="mx-6">
            <a href="#" className="py-0.5">
              Blog
            </a>
          </li>
          <li className="mx-6">
            <a href="/docs" className="py-0.5">
              Docs
            </a>
          </li>
          <li className="mx-6">
            <a href="/pricing" className="py-0.5">
              Pricing
            </a>
          </li>
          <li className="mx-6">
            <a
              href="/careers"
              className="inline-flex items-center rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-gray-800"
            >
              We're hiring
            </a>
          </li>
        </ul>
      </Transition>
    </>
  )
}

export default WebsiteNavigation
