'use client'

import { Section } from '@/components/Landing/Section'
import { TopbarNavigation } from '@/components/Landing/TopbarNavigation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function Layout({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    window.scroll(0, 0)

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [pathname])

  return (
    <div className="flex w-full flex-col items-center bg-[radial-gradient(800px_at_top,rgba(20,20,25,1)_0%,rgba(0,0,0,1)_100%)] dark:bg-black">
      <Section
        wrapperClassName={twMerge(
          'sticky top-0 z-30 transition-colors duration-500',
          isScrolled ? 'bg-black' : 'bg-transparent',
        )}
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
      className="dark:bg-polar-900 flex w-full flex-col items-center justify-center bg-gray-50"
      initial="initial"
      variants={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileInView="animate"
      viewport={{ once: true }}
    >
      <Footer wide={true} />
    </motion.div>
  )
}
