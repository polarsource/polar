'use client'

import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import TopbarLayout from '../Layout/TopbarLayout'
import { StaggerReveal } from './StaggerReveal'

const PageNotFound = () => {
  return (
    <TopbarLayout hideProfile logoPosition="center" logoTile=" ">
      <StaggerReveal
        className="flex h-screen w-full flex-col items-center justify-center gap-y-16 px-12"
        transition={{ staggerChildren: 0.2 }}
      >
        <StaggerReveal.Child transition={{ duration: 1 }}>
          <h1 className="text-4xl text-blue-500 dark:text-blue-400">404</h1>
        </StaggerReveal.Child>
        <StaggerReveal.Child transition={{ duration: 1 }}>
          <h1 className="max-w-xl text-center text-4xl leading-normal">
            We couldn&apos;t find the page you were looking for
          </h1>
        </StaggerReveal.Child>
        <StaggerReveal.Child transition={{ duration: 1 }}>
          <Link href={`/`}>
            <Button>Take me home</Button>
          </Link>
        </StaggerReveal.Child>
      </StaggerReveal>
    </TopbarLayout>
  )
}

export default PageNotFound
