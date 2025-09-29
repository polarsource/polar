'use client'

import { Footer } from '@/components/Vision/Footer'
import { DNASection } from '@/components/Vision/sections/DNASection'
import { EntitlementsSection } from '@/components/Vision/sections/EntitlementsSection'
import { IndexSection } from '@/components/Vision/sections/IndexSection'
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
    onUp: () => setIndex((index) => Math.max(0, index - 1)),
    onDown: () => setIndex((index) => Math.min(sections.length - 1, index + 1)),
    onNumberPress: (number) =>
      setIndex(Math.max(0, Math.min(number, sections.length - 1))),
  })

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="border-polar-200 bg-polar-900 relative w-full border-2">
        <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
          <span className="font-bold">Polar Software Inc.</span>
          <span className="mb-1 h-0.5 w-2 self-end bg-black" />
        </div>
      </div>
      <div className="border-polar-200 divide-polar-200 relative flex h-full flex-row divide-x border">
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
        <div className="divide-polar-200 flex h-full w-full flex-col justify-between divide-y">
          <AnimatePresence key={index}>
            <motion.div
              className="relative flex h-full flex-col overflow-y-auto p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.06, repeat: 2 }}
            >
              <motion.div
                className="bg-polar-900 pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-3/4"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.07, delay: 0.06 }}
              />
              <IndexSection active={index == 0} />
              <UsageBasedSection active={index == 1} />
              <EntitlementsSection active={index == 2} />
              <DNASection active={index == 3} />
              <OpenSourceSection active={index == 4} />
              <TeamSection active={index == 5} />
            </motion.div>
          </AnimatePresence>

          <pre className="flex h-48 flex-shrink-0 flex-col p-8">
            {`$ cat payments.md
Hello World`}
          </pre>
        </div>
      </div>
      <Footer />
    </div>
  )
}
