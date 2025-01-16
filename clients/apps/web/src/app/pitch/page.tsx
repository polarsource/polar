'use client'

import { Footer } from '@/components/Pitch/Footer'
import { IndexSection } from '@/components/Pitch/sections/IndexSection'
import { InvestorsSection } from '@/components/Pitch/sections/InvestorsSection'
import { Polar20Section } from '@/components/Pitch/sections/Polar20'
import { TeamSection } from '@/components/Pitch/sections/TeamSection'
import { UsageBasedSection } from '@/components/Pitch/sections/UsageBasedSection'
import { WhySection } from '@/components/Pitch/sections/WhySection'
import { useArrowFocus } from '@/components/Pitch/useArrowFocus'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { PitchNavigation, sections } from '../../components/Pitch/Navigation'

export default function PitchPage() {
  const [index, setIndex] = useState(0)

  useArrowFocus({
    onLeft: () => setIndex((index) => Math.max(0, index - 1)),
    onRight: () =>
      setIndex((index) => Math.min(sections.length - 1, index + 1)),
    onNumberPress: (number) =>
      setIndex(Math.max(0, Math.min(number, sections.length - 1))),
  })

  const getActiveSection = useCallback(() => {
    switch (index) {
      case 0:
      default:
        return <IndexSection />
      case 1:
        return <UsageBasedSection />
      case 2:
        return <WhySection />
      case 3:
        return <Polar20Section />
      case 4:
        return <IndexSection />
      case 5:
        return <TeamSection />
      case 6:
        return <InvestorsSection />
    }
  }, [index])

  return (
    <div className="flex h-full flex-col justify-between gap-y-12 text-sm">
      <div className="flex flex-grow flex-col gap-y-16">
        <PitchNavigation activeIndex={index} setIndex={setIndex} />
        <AnimatePresence key={index}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.07, repeat: 2 }}
          >
            {getActiveSection()}
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
