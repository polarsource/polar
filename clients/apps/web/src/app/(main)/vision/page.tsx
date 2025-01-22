'use client'

import { Footer } from '@/components/Vision/Footer'
import { DNASection } from '@/components/Vision/sections/DNASection'
import { EntitlementsSection } from '@/components/Vision/sections/EntitlementsSection'
import { IndexSection } from '@/components/Vision/sections/IndexSection'
import { InvestorsSection } from '@/components/Vision/sections/InvestorsSection'
import { OpenSourceSection } from '@/components/Vision/sections/OpenSourceSection'
import { TeamSection } from '@/components/Vision/sections/TeamSection'
import { UsageBasedSection } from '@/components/Vision/sections/UsageBasedSection'
import { useArrowFocus } from '@/components/Vision/useArrowFocus'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import {
  PitchNavigation,
  sections,
} from '../../../components/Vision/Navigation'

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
    <div className="flex h-full flex-col justify-between gap-y-12 text-sm">
      <div className="relative flex flex-grow flex-col gap-y-16">
        <PitchNavigation
          activeIndex={index}
          setIndex={(index) => {
            const sectionId = `0${index}`
            document
              .getElementById(sectionId)
              ?.scrollIntoView({ behavior: 'smooth' })

            setIndex(index)
          }}
        />
        <AnimatePresence key={index}>
          <motion.div
            className="bg-polar-900 pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-3/4"
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
            <IndexSection active={index == 0} />
            <UsageBasedSection active={index == 1} />
            <EntitlementsSection active={index == 2} />
            <DNASection active={index == 3} />
            <OpenSourceSection active={index == 4} />
            <TeamSection active={index == 5} />
            <InvestorsSection active={index == 6} />
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
