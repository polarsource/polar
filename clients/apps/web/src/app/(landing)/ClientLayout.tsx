'use client'

import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { StarOutlineOutlined } from '@mui/icons-material'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { PropsWithChildren, useEffect } from 'react'

export default function Layout({ children }: PropsWithChildren) {
  const pathname = usePathname()

  useEffect(() => {
    window.scroll(0, 0)
  }, [pathname])

  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="flex h-fit w-full max-w-[100vw] flex-row justify-stretch md:max-w-7xl">
        <div className="flex w-full flex-grow flex-col">
          <LandingPageTopbar />
          {children}
        </div>
      </div>
      <LandingPageFooter />
    </div>
  )
}

const LandingPageTopbar = () => {
  return (
    <div className="flex flex-row items-center justify-between bg-transparent px-8 py-8 md:px-12">
      <BrandingMenu className="hidden md:block" logoVariant="logotype" />
      <BrandingMenu className="md:hidden" />
      <div className="flex flex-row items-center gap-x-6">
        <Link href="https://github.com/polarsource/polar" target="_blank">
          <Button
            className="rounded-lg bg-blue-50 px-3 py-4"
            variant="secondary"
          >
            <div className="flex flex-row items-center gap-x-2">
              <StarOutlineOutlined fontSize="small" />
              <span>Star on GitHub</span>
            </div>
          </Button>
        </Link>
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

const LandingPageFooter = () => {
  return (
    <motion.div
      className="dark:bg-polar-900 flex w-full flex-col items-center justify-center bg-white"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer wide={true} showUpsellFooter={false} />
    </motion.div>
  )
}
