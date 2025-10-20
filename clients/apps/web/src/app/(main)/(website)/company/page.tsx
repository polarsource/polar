'use client'

import { Footer } from '@/components/Vision/Footer'
import { CareersSection } from '@/components/Vision/sections/CareersSection'
import { CompanySection } from '@/components/Vision/sections/CompanySection'
import { InvestorsSection } from '@/components/Vision/sections/InvestorsSection'
import { useArrowFocus } from '@/components/Vision/useArrowFocus'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Navigation, sections } from '../../../../components/Vision/Navigation'
import { investors } from './investors'

export default function PitchPage() {
  const [index, setIndex] = useState(0)

  useArrowFocus({
    onLeft: () => setIndex((index) => Math.max(0, index - 1)),
    onRight: () =>
      setIndex((index) => Math.min(sections.length - 1, index + 1)),
    onNumberPress: (number) =>
      setIndex(Math.max(0, Math.min(number, sections.length - 1))),
  })

  return (
    <div className="flex h-full flex-col justify-between text-sm">
      <Navigation
        activeIndex={index}
        setIndex={(index) => {
          const sectionId = `0${index}`
          document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: 'smooth' })

          setIndex(index)
        }}
      />
      <div className="relative flex flex-grow flex-col gap-y-16 overflow-y-auto pt-12">
        <AnimatePresence key={index}>
          <motion.div
            className="bg-polar-900 pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-3/4"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.07, delay: 0.06 }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.06, repeat: 2 }}
          >
            <CompanySection active={index === 0} />
            <CareersSection active={index === 1} />
            <InvestorsSection active={index === 2} investors={investors} />
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
