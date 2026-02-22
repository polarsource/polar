'use client'

import { Headline } from '@polar-sh/orbit'
import { motion } from 'framer-motion'
import { CompanyNav } from '../CompanyNav'

const investors = [
  { name: 'Accel', company: 'Venture Capital Firm' },
  { name: 'Abstract', company: 'Venture Capital Firm' },
  { name: 'Mischief', company: 'Venture Capital Firm' },
  { name: 'Guillermo Rauch', company: 'Vercel' },
  { name: 'Paul Copplestone', company: 'Supabase' },
  { name: 'Tobi Lütke', company: 'Shopify' },
  { name: 'Anton Osika', company: 'Lovable' },
  { name: 'Michael Grinich', company: 'WorkOS' },
  { name: 'Thomas Paul Mann', company: 'Raycast' },
  { name: 'Jorn van Dijk & Koen Bok', company: 'Framer' },
  { name: 'Harley Finkelstein', company: 'Shopify' },
  { name: 'Jared Palmer', company: 'GitHub & Microsoft' },
  { name: 'Zeno Rocha', company: 'Resend' },
  { name: 'Steven Tey', company: 'Dub' },
  { name: 'Sébastien & Alexandre Chopin', company: 'Nuxt' },
  { name: 'Gustaf Alstromer', company: 'Y Combinator' },
  { name: 'Mitchell Hashimoto', company: 'Ghostty' },
  { name: 'David Cramer', company: 'Sentry' },
  { name: 'Carl Rivera', company: 'Shopify' },
  { name: 'Kaj Drobin', company: 'Stilla' },
  { name: 'Siavash Ghorbani', company: 'Stilla' },
  { name: 'Fredrik Björk', company: 'Grafbase' },
  { name: 'Joel Hellermark', company: 'Sana' },
  { name: 'Andrea Wang', company: 'SV Angel' },
  { name: 'Kieran Flanagan', company: 'HubSpot' },
  { name: 'Sri Batchu', company: 'The RealReal' },
  { name: 'Tristan Handy', company: 'dbt Labs' },
  { name: 'Mattias Miksche', company: '—' },
]

export default function InvestorsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-y-24 px-8 py-12 md:px-12">
      <CompanyNav />

      <Headline as="h1" text="Investors" animate />

      <motion.div
        className="grid grid-cols-5 gap-32"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        <div className="col-span-1 pt-0.5">
          <Headline text="Angels & Advisors" as="span" />
        </div>
        <div className="col-span-4 grid grid-cols-3 gap-x-8 gap-y-6">
          {investors.map(({ name, company }) => (
            <div key={name} className="flex flex-col">
              <span className="text-lg font-medium text-black dark:text-white">
                {name}
              </span>
              <span className="dark:text-polar-500 text-neutral-400">
                {company}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
