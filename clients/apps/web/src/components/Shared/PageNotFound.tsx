'use client'

import Link from 'next/link'
import LogoType from '../Brand/logos/LogoType'

const PageNotFound = () => {
  return (
    <div className="dark:bg-polar-950 flex h-screen w-full flex-col items-center justify-center gap-y-12 bg-gray-50 px-12">
      <div className="flex flex-col items-center justify-center gap-y-1">
        <h1 className="text-2xl font-medium text-black dark:text-white">
          Page not found
        </h1>
        <p className="dark:text-polar-400 -mb-1 max-w-md text-center text-base text-balance text-gray-600">
          Sorry, but the page you&rsquo;re looking for doesn&rsquo;t exist or
          has been moved.
        </p>
      </div>
      <ul className="dark:text-polar-400 dark:bg-polar-800 flex max-w-md items-center gap-x-2 rounded-lg bg-white p-1.5 px-3 text-center text-sm leading-normal text-balance text-gray-600">
        <li>
          <Link
            href="/"
            className="dark:hover:text-polar-300 block p-1 hover:text-gray-700 hover:underline"
            prefetch={false}
          >
            Homepage
          </Link>
        </li>
        <li className="dark:text-polar-500 user-select-none text-gray-400">
          ·
        </li>
        <li>
          <a
            href="https://polar.sh/docs"
            className="dark:hover:text-polar-300 block p-1 hover:text-gray-700 hover:underline"
          >
            Documentation
          </a>
        </li>
        <li className="dark:text-polar-500 user-select-none text-gray-400">
          ·
        </li>
        <li>
          <a
            href="mailto:support@polar.sh"
            className="dark:hover:text-polar-300 block p-1 hover:text-gray-700 hover:underline"
          >
            Support
          </a>
        </li>
      </ul>
      <LogoType className="h-5 text-black dark:text-white" />
    </div>
  )
}

export default PageNotFound
