'use client'

import { ArrowForwardOutlined } from '@mui/icons-material'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface FeatureItemProps {
  className?: string
  icon?: JSX.Element
  title: string
  description: string
  link: string
  showLink?: boolean
  linkDescription?: string
}

const FeatureItem = ({
  title,
  icon,
  description,
  link,
  showLink = true,
  linkDescription = 'Learn more',
  className,
  children,
}: PropsWithChildren<FeatureItemProps>) => {
  return (
    <Link
      className={twMerge('group flex h-full flex-col', className)}
      href={link}
    >
      <Card className="dark:bg-polar-900 bg-gray-75 flex h-full flex-col p-1 transition-colors">
        <CardHeader className="flex flex-row items-center gap-x-3 space-y-0 pb-4">
          {icon ? (
            <span className="dark:bg-polar-700 dark flex h-10 w-10 flex-col items-center justify-center rounded-full bg-white text-xl shadow-sm transition-colors">
              {React.cloneElement(icon, { fontSize: 'inherit' })}
            </span>
          ) : (
            <div className="-mr-4 h-10" />
          )}
          <h3 className="text-lg leading-snug">{title}</h3>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-y-4 pb-6">
          <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500 transition-colors group-hover:text-black dark:group-hover:text-white">
            {description}
          </p>
          {showLink && (
            <div className="dark:text-polar-200 flex flex-row items-center gap-x-2 text-sm transition-colors group-hover:text-blue-500 dark:group-hover:text-white">
              <span>{linkDescription}</span>
              <ArrowForwardOutlined fontSize="inherit" />
            </div>
          )}
        </CardContent>
        {children && (
          <CardFooter className="justify-betwee mt-4 flex flex-row items-center">
            {children}
          </CardFooter>
        )}
      </Card>
    </Link>
  )
}

export default FeatureItem
