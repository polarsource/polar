'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import CurlIcon from '../Icons/frameworks/curl'
import GoIcon from '../Icons/frameworks/go'
import NodeJsIcon from '../Icons/frameworks/nodejs'
import PhpIcon from '../Icons/frameworks/php'
import PythonIcon from '../Icons/frameworks/python'
interface Framework {
  name: string
  icon: React.ReactNode
  href: string
}

const frameworks: Framework[] = [
  {
    name: 'Node.js',
    icon: <NodeJsIcon aria-hidden="true" />,
    href: 'https://docs.polar.sh/documentation/sdks/typescript-sdk',
  },
  {
    name: 'Python',
    icon: <PythonIcon aria-hidden="true" />,
    href: 'https://docs.polar.sh/documentation/sdks/python-sdk',
  },
  {
    name: 'PHP',
    icon: <PhpIcon aria-hidden="true" />,
    href: 'https://github.com/polarsource/polar-php',
  },
  {
    name: 'Go',
    icon: <GoIcon aria-hidden="true" />,
    href: 'https://github.com/polarsource/polar-go',
  },
  {
    name: 'CURL',
    icon: <CurlIcon aria-hidden="true" />,
    href: 'https://docs.polar.sh/api-reference',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1 } },
}

export default function FrameworkSelector() {
  return (
    <motion.div
      className="flex h-24 w-full flex-row items-center justify-center gap-x-4 md:w-3/4 md:gap-x-24 md:self-center"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {frameworks.map((framework) => (
        <Link
          key={framework.name}
          href={framework.href}
          className="h-full w-full rounded-2xl outline-none focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 md:text-sm dark:text-white dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
        >
          <motion.div
            key={framework.name}
            className="dark:hover:bg-polar-900 group flex h-full w-full flex-1 flex-col items-center justify-center rounded-md hover:bg-gray-100"
            variants={itemVariants}
          >
            <div className="flex flex-col opacity-50 transition-all duration-200 group-hover:opacity-100">
              {framework.icon}
            </div>
          </motion.div>
        </Link>
      ))}
    </motion.div>
  )
}
