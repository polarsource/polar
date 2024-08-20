'use client'

import { Section } from './Section'
import { APIFirst } from './molecules/APIFirst'

export const API = () => {
  return (
    <Section
      id="integrations"
      className="flex flex-col items-center justify-center gap-y-24"
      wrapperClassName="overflow-hidden"
    >
      <div className="grid grid-cols-1 divide-x md:grid-cols-2">
        <div className="flex flex-col gap-y-12 pr-32">
          <div className="flex flex-col gap-y-4 text-center">
            <span className="font-mono text-xs uppercase tracking-wider dark:text-blue-400">
              Public Page
            </span>
            <h3 className="text-3xl font-medium leading-snug">
              A frontpage for your projects
            </h3>
            <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
              Showcase your repositories, products, subscriptions & more.
            </p>
          </div>

          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/public_page_dark.png`}
            />
            <img
              className="dark:border-polar-700 rounded-2xl border border-gray-100"
              srcSet={`/assets/landing/public_page.png`}
              alt="Polar Public page"
            />
          </picture>
        </div>
        <div className="flex flex-col gap-y-12 pl-32">
          <div className="flex flex-col gap-y-4 text-center">
            <span className="font-mono text-xs uppercase tracking-wider dark:text-yellow-400">
              API & Developer First
            </span>
            <h3 className="text-3xl font-medium leading-snug">
              The API sits in the front seat
            </h3>
            <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
              Use our OAuth, API & Webhooks to ship custom integrations across
              docs, sites, apps and services.
            </p>
          </div>
          <APIFirst />
        </div>
      </div>
    </Section>
  )
}
