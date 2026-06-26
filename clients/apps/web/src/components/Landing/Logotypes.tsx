import { motion } from 'motion/react'
import Link from 'next/link'
import { JSX } from 'react'
import {
  FastAPICloud,
  MiddayWordmark,
  Speakeasy,
  Spotify,
  StillaAIWordmark,
  Tailwind,
} from './Logos'

const items = [
  {
    icon: <Spotify size={32} />,
    link: 'https://confidence.spotify.com/',
  },
  {
    icon: <Tailwind size={20} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <FastAPICloud size={26} />,
    link: 'https://fastapicloud.com/',
  },
  /* {
    icon: <Goals size={20} />,
    link: 'https://playgoals.com',
  }, */
  {
    icon: <Speakeasy />,
    link: 'https://speakeasy.com',
  },
  {
    icon: <StillaAIWordmark size={26} />,
    link: 'https://stilla.ai',
  },
]

// Duplicate for seamless marquee loop
const marqueeItems = [...items, ...items]

interface LogotypeProps {
  icon: JSX.Element
  link: string
}

const Logotype = ({ icon, link }: LogotypeProps) => (
  <Link
    className="flex shrink-0 flex-col items-center justify-center"
    target="_blank"
    href={link}
  >
    {icon}
  </Link>
)

export const Logotypes = () => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-y-16 py-12"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 2 } },
      }}
      animate="visible"
      initial="hidden"
    >
      {/* Mobile: masked marquee */}
      <div
        className="w-full max-w-full overflow-hidden xl:hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
        }}
      >
        <motion.div
          className="flex w-max items-center gap-x-16"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          {marqueeItems.map((item, i) => (
            <Logotype
              key={`${item.link}-${i}`}
              icon={item.icon}
              link={item.link}
            />
          ))}
        </motion.div>
      </div>

      {/* Desktop: static row */}
      <div className="hidden items-center gap-x-12 xl:flex">
        {items.map((item) => (
          <Logotype key={item.link} icon={item.icon} link={item.link} />
        ))}
      </div>
    </motion.div>
  )
}
