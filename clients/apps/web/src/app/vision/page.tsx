'use client'

import { Footer } from '@/components/About/Footer'
import { IndexSection } from '@/components/About/sections/IndexSection'
import { InvestorsSection } from '@/components/About/sections/InvestorsSection'
import { OpenSourceSection } from '@/components/About/sections/OpenSource'
import { Polar20Section } from '@/components/About/sections/Polar20'
import { SevenLOCSection } from '@/components/About/sections/SevenLOC'
import { TeamSection } from '@/components/About/sections/TeamSection'
import { UsageBasedSection } from '@/components/About/sections/UsageBasedSection'
import { useArrowFocus } from '@/components/About/useArrowFocus'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { PitchNavigation, sections } from '../../components/About/Navigation'

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
      <div className="flex flex-grow flex-col gap-y-16">
        <PitchNavigation activeIndex={index} setIndex={setIndex} />
        <AnimatePresence key={index}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.07, repeat: 2 }}
          >
            {activeSection}
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
