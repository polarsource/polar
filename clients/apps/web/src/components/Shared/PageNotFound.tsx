'use client'

import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'

const PageNotFound = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-y-16 px-12">
      <h1 className="text-4xl text-blue-500 dark:text-blue-400">404</h1>
      <h1 className="max-w-xl text-center text-4xl leading-normal">
        We couldn&apos;t find the page you were looking for
      </h1>
      <Link href={`/`}>
        <Button>Take me home</Button>
      </Link>
    </div>
  )
}

export default PageNotFound
