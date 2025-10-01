import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export const sections = ['00. Company', '01. Careers', '02. Investors']

export const Navigation = ({
  activeIndex,
  setIndex,
}: {
  activeIndex: number
  setIndex: (index: number) => void
}) => {
  return (
    <div className="flex flex-col gap-y-8 text-xs md:flex-row md:gap-x-16">
      <Link href="/">Polar Software Inc.</Link>
      <ul className="flex flex-col gap-y-2 md:flex-row md:gap-x-8">
        <AnimatePresence key={activeIndex}>
          {sections.map((section, index) => (
            <motion.li
              key={index}
              onClick={() => setIndex(index)}
              className={twMerge(
                'hover:bg-polar-200 cursor-default px-1 hover:text-black',
                index === activeIndex ? 'bg-polar-200 text-black' : '',
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05, repeat: 2 }}
            >
              {section}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
