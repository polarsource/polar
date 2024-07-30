'use client'

import { Section } from '@/components/Landing/Section'
import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
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
    <div className="dark:bg-polar-950 flex w-full flex-col items-center bg-white">
      <Section
        wrapperClassName="sticky top-0 z-30 dark:bg-polar-950 bg-white"
        className="py-4 md:py-8"
      >
        <LandingPageTopbar />
      </Section>
      {children}
      <LandingPageFooter />
    </div>
  )
}

const LandingPageTopbar = () => {
  return (
    <div className="relative flex flex-row items-center justify-between bg-transparent">
      <TopbarNavigation />
      <BrandingMenu
        className="mt-1 hidden md:block"
        size={100}
        logoVariant="logotype"
      />
      <BrandingMenu
        className="ml-2 mt-1 md:hidden"
        logoVariant="logotype"
        size={100}
      />
      <div className="flex flex-row items-center gap-x-4">
        <a
          href="https://github.com/polarsource/polar"
          className="dark:text-polar-200 dark:bg-polar-800 dark:hover:bg-polar-700 transition-color hidden flex-row items-center gap-x-2 rounded-full bg-gray-100 px-4 py-1.5 text-sm hover:bg-gray-200 md:flex"
        >
          Star on GitHub
        </a>
        <Link href="/login">
          <Button>Login</Button>
        </Link>
      </div>
    </div>
  )
}

const LandingPageFooter = () => {
  return (
    <motion.div
      className="dark:bg-polar-900 mt-24 flex w-full flex-col items-center justify-center bg-white"
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
