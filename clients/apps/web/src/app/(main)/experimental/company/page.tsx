'use client'

import { Headline } from '@polar-sh/orbit'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { CompanyNav } from './CompanyNav'

const sections = [
  {
    label: 'Story',
    image: {
      src: '/assets/team/birk_02.jpg',
      className: 'object-left',
      width: 800,
      height: 1200,
    },
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi id nunc et orci molestie lobortis vitae porta orci. Etiam rutrum hendrerit dui, sit amet maximus eros pellentesque non. In luctus elementum risus non rutrum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec justo est, bibendum vulputate consectetur vitae, pharetra imperdiet magna.',
      'Morbi blandit varius velit ut lobortis. Mauris scelerisque elementum ipsum, ut porttitor ligula mollis nec. Suspendisse scelerisque felis at neque cursus fermentum.',
      'Curabitur dignissim velit eget vestibulum lacinia. Maecenas sit amet tristique risus. Vivamus fermentum nunc nisi, et dictum augue imperdiet id. Etiam dapibus pretium commodo. Maecenas ut dolor laoreet, malesuada arcu eget, elementum eros. Nam et scelerisque enim.',
      'Morbi blandit varius velit ut lobortis. Mauris scelerisque elementum ipsum, ut porttitor ligula mollis nec. Suspendisse scelerisque felis at neque cursus fermentum.',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi id nunc et orci molestie lobortis vitae porta orci. Etiam rutrum hendrerit dui, sit amet maximus eros pellentesque non. In luctus elementum risus non rutrum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec justo est, bibendum vulputate consectetur vitae, pharetra imperdiet magna.',
    ],
  },
  {
    label: 'Mission',
    image: {
      src: '/assets/team/francois_02.jpg',
      className: '',
      width: 1200,
      height: 800,
    },
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi id nunc et orci molestie lobortis vitae porta orci. Etiam rutrum hendrerit dui, sit amet maximus eros pellentesque non. In luctus elementum risus non rutrum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec justo est, bibendum vulputate consectetur vitae, pharetra imperdiet magna.',
      'Morbi blandit varius velit ut lobortis. Mauris scelerisque elementum ipsum, ut porttitor ligula mollis nec. Suspendisse scelerisque felis at neque cursus fermentum.',
      'Curabitur dignissim velit eget vestibulum lacinia. Maecenas sit amet tristique risus. Vivamus fermentum nunc nisi, et dictum augue imperdiet id. Etiam dapibus pretium commodo. Maecenas ut dolor laoreet, malesuada arcu eget, elementum eros. Nam et scelerisque enim.',
      'Morbi blandit varius velit ut lobortis. Mauris scelerisque elementum ipsum, ut porttitor ligula mollis nec. Suspendisse scelerisque felis at neque cursus fermentum.',
    ],
  },
  {
    label: 'Open Source',
    paragraphs: [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi id nunc et orci molestie lobortis vitae porta orci. Etiam rutrum hendrerit dui, sit amet maximus eros pellentesque non. In luctus elementum risus non rutrum. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec justo est, bibendum vulputate consectetur vitae, pharetra imperdiet magna.',
      'Morbi blandit varius velit ut lobortis. Mauris scelerisque elementum ipsum, ut porttitor ligula mollis nec. Suspendisse scelerisque felis at neque cursus fermentum.',
    ],
  },
]

export default function CompanyPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-y-24 px-8 py-12 md:px-12">
      <CompanyNav />

      {/* Headline */}
      <Headline as="h1" text={['Polar', 'Software Inc']} animate />

      {/* Sections */}
      <motion.div
        className="flex flex-col gap-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        {sections.map(({ label, paragraphs, image }) => (
          <div key={label} className="grid grid-cols-5 gap-32">
            <div className="col-span-1 pt-0.5">
              <Headline text={label} as="span" />
            </div>
            <div className="col-span-2 flex flex-col gap-4 leading-relaxed">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {image && (
              <div className="col-span-2">
                <Image
                  width={image?.width}
                  height={image?.height}
                  alt={label}
                  className={twMerge(
                    'dark:bg-polar-800 aspect-square w-full bg-neutral-100 object-cover',
                    image.className,
                  )}
                  src={image?.src}
                />
              </div>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
