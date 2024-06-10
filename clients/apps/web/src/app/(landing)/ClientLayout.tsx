'use client'

import { Section } from '@/components/Landing/Section'
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
    <div className="flex w-full flex-col items-center">
      <Section>
        <LandingPageTopbar />
      </Section>
      {children}
      <LandingPageFooter />
    </div>
  )
}

const LandingPageTopbar = () => {
  return (
    <div className="relative flex flex-row items-center justify-end bg-transparent py-16">
      <BrandingMenu
        className="absolute left-1/2 hidden -translate-x-1/2 md:block"
        size={70}
      />
      <BrandingMenu className="md:hidden" />
      <div className="flex flex-row items-center gap-x-6">
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
