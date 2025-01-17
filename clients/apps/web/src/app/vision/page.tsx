'use client'

import { Footer } from '@/components/Vision/Footer'
import { IndexSection } from '@/components/Vision/sections/IndexSection'
import { InvestorsSection } from '@/components/Vision/sections/InvestorsSection'
import { OpenSourceSection } from '@/components/Vision/sections/OpenSourceSection'
import { Polar20Section } from '@/components/Vision/sections/Polar20Section'
import { SevenLOCSection } from '@/components/Vision/sections/SevenLOCSection'
import { TeamSection } from '@/components/Vision/sections/TeamSection'
import { UsageBasedSection } from '@/components/Vision/sections/UsageBasedSection'
import { useArrowFocus } from '@/components/Vision/useArrowFocus'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { PitchNavigation, sections } from '../../components/Vision/Navigation'

export default function PitchPage() {
  const [index, setIndex] = useState(0)

  useArrowFocus({
    onLeft: () => setIndex((index) => Math.max(0, index - 1)),
    onRight: () =>
      setIndex((index) => Math.min(sections.length - 1, index + 1)),
    onNumberPress: (number) =>
      setIndex(Math.max(0, Math.min(number, sections.length - 1))),
  })

  const activeSection = useMemo(() => {
    switch (index) {
      case 0:
      default:
        return <IndexSection />
      case 1:
        return <UsageBasedSection />
      case 2:
        return <SevenLOCSection />
      case 3:
        return <Polar20Section />
      case 4:
        return <OpenSourceSection />
      case 5:
        return <TeamSection />
      case 6:
        return <InvestorsSection />
    }
  }, [index])

  return (
    <div className="flex h-full flex-col justify-between gap-y-12 text-sm">
      <div className="relative flex flex-grow flex-col gap-y-16">
        <PitchNavigation activeIndex={index} setIndex={setIndex} />
        <AnimatePresence key={index}>
          <motion.div
            className="bg-polar-900 absolute bottom-0 left-0 right-0 z-20 h-1/2"
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
            {activeSection}
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
