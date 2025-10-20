'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import Image from 'next/image'
import React from 'react'

interface SplitPromoProps {
  title: string
  description: string
  bullets?: string[]
  cta1?: React.ReactNode
  cta2?: React.ReactNode
  image: string
  reverse?: boolean
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1 } },
}

export const SplitPromo: React.FC<SplitPromoProps> = ({
  title,
  description,
  bullets,
  cta1,
  cta2,
  image,
  reverse = false,
}) => {
  return (
    <motion.div
      className={`flex w-full flex-col overflow-hidden rounded-2xl md:flex-row md:rounded-4xl ${reverse ? 'md:flex-row-reverse' : ''} dark:bg-polar-900 bg-white md:items-stretch`}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="flex flex-1 flex-col justify-center gap-y-8 p-8 md:aspect-square md:p-16">
        <motion.h2
          className="text-2xl leading-normal! md:text-3xl"
          variants={itemVariants}
        >
          {title}
        </motion.h2>
        <motion.p
          className="text-lg leading-relaxed text-pretty"
          variants={itemVariants}
        >
          {description}
        </motion.p>
        {bullets && bullets.length > 0 && (
          <ul className="flex flex-col gap-y-1">
            {bullets.map((bullet, index) => (
              <motion.li
                key={index}
                className="flex flex-row items-center gap-x-2"
                variants={itemVariants}
              >
                <Check className="h-4 w-4 text-emerald-500" />
                <p className="leading-relaxed text-pretty">{bullet}</p>
              </motion.li>
            ))}
          </ul>
        )}
        <motion.div
          className="flex flex-row items-center gap-x-6"
          variants={itemVariants}
        >
          {cta1}
          {cta2}
        </motion.div>
      </div>
      <motion.div
        className="relative flex aspect-square flex-1 p-8 md:p-16"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <Image
          className="absolute inset-0 h-full w-full object-cover"
          src={image}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 100vw, 1280px"
          loading="lazy"
          alt={title}
        />
      </motion.div>
    </motion.div>
  )
}
