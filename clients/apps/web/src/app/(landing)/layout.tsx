import LogoType from '@/components/Brand/LogoType'
import { StarOutlineOutlined } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { PropsWithChildren } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="dark:border-polar-700 flex w-full max-w-7xl flex-col border-l border-r border-blue-100">
        <LandingPageTopbar />
        {children}
      </div>
    </div>
  )
}

const LandingPageTopbar = () => {
  return (
    <div className="dark:border-polar-700 flex flex-row items-center justify-between border-b border-blue-100 px-8 py-6">
      <LogoType width={80} />
      <div className="flex flex-row items-center gap-x-6">
        <Button className="rounded-lg bg-blue-50 px-3 py-4" variant="secondary">
          <div className="flex flex-row items-center gap-x-2">
            <StarOutlineOutlined fontSize="small" />
            <span>Star on GitHub</span>
          </div>
        </Button>
        <Link
          href="/login"
          className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Login
        </Link>
      </div>
    </div>
  )
}
