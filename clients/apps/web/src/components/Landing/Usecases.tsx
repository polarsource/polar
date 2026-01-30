'use client'

import React, { useState, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import KeyboardArrowLeftOutlined from '@mui/icons-material/KeyboardArrowLeftOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import { Section } from './Section'
import AnimatedInfinity from './animated/AnimatedInfinity'

// SVG Illustrations for each use case
const SaasIllustration = () => (
  <svg viewBox="0 0 200 140" className="h-full w-full">
    {/* Dashboard window */}
    <rect x="20" y="20" width="160" height="100" rx="4" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-600 dark:text-gray-600" />
    {/* Header bar */}
    <line x1="20" y1="40" x2="180" y2="40" stroke="currentColor" strokeWidth="1" className="text-gray-600 dark:text-gray-600" />
    {/* Sidebar */}
    <line x1="60" y1="40" x2="60" y2="120" stroke="currentColor" strokeWidth="1" className="text-gray-600 dark:text-gray-600" />
    {/* Menu items */}
    <rect x="28" y="50" width="24" height="4" rx="1" fill="currentColor" className="text-blue-500" />
    <rect x="28" y="62" width="24" height="4" rx="1" fill="currentColor" className="text-gray-500 dark:text-gray-600" />
    <rect x="28" y="74" width="24" height="4" rx="1" fill="currentColor" className="text-gray-500 dark:text-gray-600" />
    {/* Content cards */}
    <rect x="70" y="50" width="45" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <rect x="125" y="50" width="45" height="30" rx="2" fill="none" stroke="currentColor" strokeWidth="1" className="text-blue-500" />
    {/* Chart bars */}
    <rect x="75" y="95" width="8" height="15" fill="currentColor" className="text-gray-500 dark:text-gray-600" />
    <rect x="88" y="88" width="8" height="22" fill="currentColor" className="text-gray-500 dark:text-gray-600" />
    <rect x="101" y="82" width="8" height="28" fill="currentColor" className="text-blue-500" />
    <rect x="114" y="90" width="8" height="20" fill="currentColor" className="text-gray-500 dark:text-gray-600" />
  </svg>
)

const ApiIllustration = () => (
  <svg viewBox="0 0 200 140" className="h-full w-full">
    {/* Central API node */}
    <rect x="70" y="45" width="60" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500" />
    <text x="100" y="75" textAnchor="middle" fontSize="12" fill="currentColor" className="text-blue-500 font-mono">API</text>
    {/* Connection lines */}
    <line x1="40" y1="35" x2="70" y2="55" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <line x1="40" y1="70" x2="70" y2="70" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <line x1="40" y1="105" x2="70" y2="85" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <line x1="130" y1="55" x2="160" y2="35" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <line x1="130" y1="70" x2="160" y2="70" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <line x1="130" y1="85" x2="160" y2="105" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    {/* Input nodes */}
    <circle cx="30" cy="35" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <circle cx="30" cy="70" r="8" fill="currentColor" className="text-blue-500" />
    <circle cx="30" cy="105" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    {/* Output nodes */}
    <circle cx="170" cy="35" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <circle cx="170" cy="70" r="8" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-500 dark:text-gray-600" />
    <circle cx="170" cy="105" r="8" fill="currentColor" className="text-blue-500" />
  </svg>
)

const DownloadIllustration = () => (
  <svg viewBox="0 0 200 140" className="h-full w-full">
    {/* File icon */}
    <path d="M60 20 L60 120 L140 120 L140 45 L115 20 Z" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-600 dark:text-gray-600" />
    <path d="M115 20 L115 45 L140 45" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-600 dark:text-gray-600" />
    {/* Download arrow */}
    <line x1="100" y1="55" x2="100" y2="90" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
    <polyline points="85,78 100,93 115,78" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
    {/* Base line */}
    <line x1="75" y1="105" x2="125" y2="105" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
  </svg>
)




type UsecaseItem = {
  title: string
  description: string
  illustration: React.ReactNode
}

const usecases: UsecaseItem[] = [
  {
    title: 'SaaS Products',
    description: 'Launch subscription-based software with flexible billing cycles and tier management.',
    illustration: <AnimatedInfinity />,
  },
  {
    title: 'AI & API Services',
    description: 'Meter and bill for API calls, tokens, or compute with usage-based pricing.',
    illustration: <ApiIllustration />,
  },
  {
    title: 'Content & Courses',
    description: 'Gate educational content, tutorials, and learning materials behind paywalls.',
    illustration: <DownloadIllustration />,
  },
]

type UsecaseCardProps = {
  item: UsecaseItem
  className?: string
}

const UsecaseCard = ({ item, className }: UsecaseCardProps) => {
  return (
    <li
      className={twMerge(
        'dark:bg-polar-950 flex flex-col gap-y-4 bg-white p-6 md:p-8 h-96',
        className
      )}
    >
      <h3 className="text-pretty text-2xl text-black dark:text-white md:text-2xl">
        {item.title}
      </h3>
      <p className="text-gray-500 dark:text-polar-500 text-xl">
        {item.description}
      </p>
      <div className="mt-auto flex h-[140px] items-center justify-center">
        {item.illustration}
      </div>
    </li>
  )
}

type UsecasesProps = {
  className?: string
}



export const Usecases = ({ className }: UsecasesProps) => {
  return (
    <Section className={twMerge('flex flex-col gap-y-12', className)}>
      <div className="flex flex-col gap-y-2">
        <h2 className="text-2xl text-black dark:text-white md:text-4xl">
          Built for every use case.
        </h2>
        <p className="text-2xl md:text-4xl text-gray-500 dark:text-polar-500">
          From SaaS to open source, we&apos;ve got you covered.
        </p>
      </div>
      <div className="bg-gray-200 p-px dark:bg-polar-800 grid grid-cols-1 xl:grid-cols-3 gap-px">
          {usecases.map((item) => (
            <UsecaseCard key={item.title} item={item} />
          ))}
      </div>
    </Section>
  )
}

export default Usecases
