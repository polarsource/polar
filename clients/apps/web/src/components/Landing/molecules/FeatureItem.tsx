'use client'

import Link from 'next/link'
import React, { PropsWithChildren, type JSX } from 'react'
import { twMerge } from 'tailwind-merge'

interface FeatureItemProps {
  className?: string
  icon?: JSX.Element
  title: string
  description: string
  link?: string
}

const FeatureItem = ({
  title,
  icon,
  description,
  link,
  className,
  children,
}: PropsWithChildren<FeatureItemProps>) => {
  return (
    <Link
      className={twMerge(
        'dark:border-polar-700 group flex h-full flex-col rounded-3xl border border-gray-200 bg-transparent p-8 transition-colors dark:bg-transparent',
        className,
      )}
      href={link ?? '#'}
    >
      <div className="flex flex-row items-center space-y-0 gap-x-3 pb-4">
        {icon && (
          <span className="dark:bg-polar-700 dark flex h-10 w-10 flex-col items-center justify-center rounded-full bg-gray-50 text-xl shadow-xs transition-colors">
            {React.cloneElement(icon, { fontSize: 'inherit' })}
          </span>
        )}
        <h3 className="text-lg leading-snug font-medium">{title}</h3>
      </div>
      <div className="flex flex-col gap-y-4 pb-6">
        <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500 transition-colors group-hover:text-black dark:group-hover:text-white">
          {description}
        </p>
      </div>
      {children && (
        <div className="mt-4 flex h-full flex-row items-center">{children}</div>
      )}
    </Link>
  )
}

export default FeatureItem
