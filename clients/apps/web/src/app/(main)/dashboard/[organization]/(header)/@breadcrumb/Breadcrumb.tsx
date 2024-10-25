import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

export const BreadcrumbSeparator = () => {
  return <span className="dark:text-polar-500 text-gray-500">/</span>
}

export const BreadcrumbLink: React.FC<
  React.PropsWithChildren<{ href: string }>
> = ({ href, children }) => {
  return (
    <Link
      href={href}
      className={twMerge(
        'dark:text-polar-500 flex flex-row items-center justify-center rounded-md px-2 py-1 text-gray-500 transition-colors',
        'last:text-black last:dark:text-white',
        'not-last:dark:hover:bg-polar-800 not-last:hover:bg-gray-50 not-last:hover:text-black not-last:dark:hover:text-white',
      )}
    >
      {children}
    </Link>
  )
}

export interface BreadcrumbPageParams {
  organization: string
}
