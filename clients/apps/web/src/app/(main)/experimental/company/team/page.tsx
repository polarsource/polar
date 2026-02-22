'use client'

import { Headline } from '@polar-sh/orbit'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { CompanyNav } from '../CompanyNav'

const team = [
  {
    name: 'Birk Jernström',
    title: 'CEO & Founder',
    image: '/assets/team/birk.png',
  },
  {
    name: 'François Voron',
    title: 'Software Engineer',
    image: '/assets/team/francois.png',
  },
  {
    name: 'Emil Widlund',
    title: 'Design Engineer',
    image: '/assets/team/emil.png',
  },
  {
    name: 'Petru Rares Sincraian',
    title: 'Software Engineer',
    image: '/assets/team/petru.png',
  },
  {
    name: 'Rishi Raj Jain',
    title: 'Customer Success Engineer',
    image: '/assets/team/rishi.png',
  },
  {
    name: 'Pieter Beulque',
    title: 'Software Engineer',
    image: '/assets/team/pieter.png',
  },
  {
    name: 'Jesper Bränn',
    title: 'Software Engineer',
    image: '/assets/team/jesper.jpg',
  },
  {
    name: 'Isac Lidén',
    title: 'Customer Support Specialist',
    image: '/assets/team/isac.jpg',
  },
  {
    name: 'Sebastian Ekström',
    title: 'Software Engineer',
    image: '/assets/team/sebastian.jpg',
  },
  {
    name: 'Victoria Bolin',
    title: 'Founder Associate',
    image: '/assets/team/victoria.jpg',
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 1.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0, 0, 1] as [number, number, number, number],
    },
  },
}

export default function TeamPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-y-24 px-8 py-12 md:px-12">
      <CompanyNav />

      <Headline as="h1" text="Team" animate />

      <motion.div
        className="grid grid-cols-4 gap-x-6 gap-y-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {team.map(({ name, title, image }) => (
          <motion.div
            key={name}
            className="group flex flex-col gap-3"
            variants={itemVariants}
          >
            <div className="overflow-hidden">
              <Image
                src={image}
                alt={name}
                width={600}
                height={800}
                className="aspect-3/4 w-full object-cover object-top grayscale transition-all duration-500 group-hover:scale-[1.03] group-hover:grayscale-0"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg text-black dark:text-white">{name}</span>
              <span className="dark:text-polar-500 text-neutral-400">
                {title}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
