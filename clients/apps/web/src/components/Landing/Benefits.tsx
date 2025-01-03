'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface BenefitItemProps {
  index: number
  title: string
  description: string
  isOpen: boolean
  onClick: (index: number) => void
  image?: string
}

const benefitItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1 } },
}

const accordionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      duration: 1,
    },
  },
}

const BenefitItem = ({
  index,
  title,
  description,
  isOpen,
  onClick,
}: BenefitItemProps) => {
  return (
    <motion.button
      className={twMerge(
        'flex w-full flex-col items-start gap-y-1 py-4 text-left',
        isOpen ? 'cursor-default' : '',
      )}
      onClick={() => !isOpen && onClick(index)}
      variants={benefitItemVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="flex w-full flex-row items-center justify-between text-lg">
        {title}
        <span className="text-2xl">{isOpen ? '-' : '+'}</span>
      </div>
      {isOpen && (
        <motion.p
          className="dark:text-polar-500 text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {description}
        </motion.p>
      )}
    </motion.button>
  )
}

interface AccordionProps {
  items: BenefitItemProps[]
  activeItem: number
  setActiveItem: (index: number) => void
}

const Accordion = ({ items, activeItem, setActiveItem }: AccordionProps) => {
  return (
    <motion.div
      className="dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 border-y border-gray-200"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={accordionVariants}
    >
      {items.map((item, index) => (
        <BenefitItem
          {...item}
          key={item.title}
          index={index}
          isOpen={activeItem === index}
          onClick={setActiveItem}
        />
      ))}
    </motion.div>
  )
}

export const Benefits = () => {
  const [activeItem, setActiveItem] = useState<number>(0)

  const items = [
    {
      title: 'License Keys',
      description: 'Sell access to your software with the License Key benefit',
      image: '/assets/landing/license.jpg',
    },
    {
      title: 'Digital Downloads',
      description: 'Make files available for download to your customers',
      image: '/assets/landing/file.jpg',
    },
    {
      title: 'GitHub Repository Access',
      description: 'Grant customers access to your GitHub repositories',
      image: '/assets/landing/github.jpg',
    },
    {
      title: 'Discord Server Access',
      description: 'Setup premium Discord roles for your customers',
      image: '/assets/landing/discord.jpg',
    },
    {
      title: 'Custom Benefit',
      description:
        'Attach a custom note which is made available to your customers when they purchase your product',
      image: '/assets/landing/note.jpg',
    },
  ]

  return (
    <div
      className={`dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-xl bg-gray-50 md:flex-row-reverse md:items-stretch`}
    >
      <div className="flex flex-1 grow flex-col gap-y-10 p-16">
        <div className="flex flex-col gap-y-4">
          <h2 className="text-2xl !leading-normal md:text-3xl">
            Automated Product Benefits
          </h2>
          <p className="dark:text-polar-500 text-lg text-gray-500">
            Configure automated benefits which are granted to customers when
            they purchase your products.
          </p>
        </div>
        <Accordion
          items={items.map((item, index) => ({
            ...item,
            index,
            isOpen: activeItem === index,
            onClick: setActiveItem,
          }))}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
        />
      </div>
      <motion.div
        className="flex aspect-square flex-1 grow flex-col bg-cover bg-center p-16 md:aspect-auto"
        style={{
          backgroundImage: `url(${items[activeItem].image})`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
      />
    </div>
  )
}
