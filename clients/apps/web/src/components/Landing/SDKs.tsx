'use client'

import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
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
    icon: <NodeJsIcon />,
    href: '/docs/developers/sdk/typescript',
  },
  { name: 'Python', icon: <PythonIcon />, href: '/docs/developers/sdk/python' },
  {
    name: 'PHP',
    icon: <PhpIcon />,
    href: 'https://github.com/polarsource/polar-php',
  },
  {
    name: 'Go',
    icon: <GoIcon />,
    href: 'https://github.com/polarsource/polar-go',
  },
  { name: 'CURL', icon: <CurlIcon />, href: '/docs/api' },
]

export default function FrameworkSelector() {
  return (
    <div className="flex flex-col gap-y-16">
      <div className="flex flex-col items-center gap-y-6">
        <h1 className="text-pretty text-center text-4xl leading-tight md:text-5xl">
          Integrate Polar{' '}
          <span className="dark:text-polar-500 text-gray-400">
            in your favorite language
          </span>
        </h1>
        <p className="dark:text-polar-500 text-center text-lg text-gray-500 md:text-2xl">
          Polar is open source & available SDK in a wide range of languages
        </p>
        <Link href="https://github.com/polarsource" target="_blank">
          <Button size="lg" variant="secondary">
            Polar on GitHub
          </Button>
        </Link>
      </div>
      <div className="dark:border-polar-700 rounded-4xl dark:divide-polar-700 hidden w-full flex-row items-center divide-x divide-gray-300 overflow-hidden border border-gray-300 md:flex">
        {frameworks.map((framework) => (
          <Link
            key={framework.name}
            href={framework.href}
            className="dark:hover:bg-polar-950 group flex h-64 flex-1 flex-col items-center justify-center gap-6 p-12 hover:bg-gray-100 hover:bg-white"
          >
            <div className="flex flex-col opacity-50 transition-all duration-200 group-hover:opacity-100">
              {framework.icon}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
