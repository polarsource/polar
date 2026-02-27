import { motion } from 'framer-motion'
import Link from 'next/link'
import { JSX } from 'react'
import { MiddayWordmark, Speakeasy, StillaAIWordmark, Tailwind } from './Logos'
import { companyTestimonials, Testamonial } from './Testimonials'

const items = [
  {
    icon: <Tailwind size={24} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <Speakeasy />,
    link: 'https://speakeasy.com',
  },
  {
    icon: <StillaAIWordmark size={30} />,
    link: 'https://stilla.ai',
  },
  {
    icon: <MiddayWordmark size={34} />,
    link: 'https://midday.ai',
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
      className="flex flex-col items-center justify-center gap-y-16"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 2 } },
      }}
      animate="visible"
      initial="hidden"
    >
      <div className="flex flex-col items-center gap-y-12">
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h3 className="text-polar-500 text-center text-2xl">
          Powering billing for thousands of startups
        </h3>
        <div className="grid grid-cols-1 flex-row items-center gap-x-16 gap-y-8 xl:flex xl:gap-x-20">
          {items.map((item) => (
            <Logotype key={item.link} icon={item.icon} link={item.link} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {companyTestimonials.map((testimonial, index) => (
          <Testamonial
            key={`testimonial-${index}`}
            size="lg"
            className={index === 0 ? 'xl:col-span-2' : ''}
            {...testimonial}
          />
        ))}
      </div>
    </motion.div>
  )
}
