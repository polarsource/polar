import { motion } from 'framer-motion'
import Link from 'next/link'
import { JSX } from 'react'
import { Goals, Speakeasy, Spotify, StillaAIWordmark, Tailwind } from './Logos'

const items = [
  {
    icon: <Spotify size={42} />,
    link: 'https://confidence.spotify.com/',
  },
  {
    icon: <Tailwind size={24} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <Goals size={24} />,
    link: 'https://playgoals.com',
  },
  {
    icon: <Speakeasy />,
    link: 'https://speakeasy.com',
  },
  {
    icon: <StillaAIWordmark size={30} />,
    link: 'https://stilla.ai',
  },
]

interface LogotypeProps {
  icon: JSX.Element
  link: string
}

const Logotype = ({ icon, link }: LogotypeProps) => {
  return (
    <Link
      className="flex flex-col items-center justify-center"
      target="_blank"
      href={link}
    >
      {icon}
    </Link>
  )
}

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
      <div className="flex flex-col items-center gap-y-12">
        <div className="grid grid-cols-1 flex-row items-center gap-x-16 gap-y-8 xl:flex xl:gap-x-20">
          {items.map((item) => (
            <Logotype key={item.link} icon={item.icon} link={item.link} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
