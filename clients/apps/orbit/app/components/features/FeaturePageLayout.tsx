'use client'

import Link from 'next/link'
import type { FeatureData } from './featureData'
import { LandingNav } from '../landing/LandingNav'
import { LandingFooter } from '../landing/LandingFooter'

export const FeaturePageLayout = ({ feature }: { feature: FeatureData }) => {
  const G = feature.Graphic

  return (
    <div className="flex min-h-screen flex-col md:px-16">
      <LandingNav />

      <div className="grid grid-cols-1 gap-24 lg:grid-cols-2">
        <div className="dark:bg-dark-900 flex w-full items-center justify-center bg-neutral-50 p-16">
          <G />
        </div>

        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-6">
            <h1 className="text-[clamp(2.5rem,5vw,5rem)] leading-[1.1] font-normal text-neutral-900 dark:text-white">
              {feature.title}
            </h1>
            <p className="max-w-lg text-2xl">{feature.subtitle}</p>
          </div>

          <p className="text-2xl">{feature.description}</p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {feature.details.map((d) => (
              <div key={d.label} className="flex flex-col gap-1">
                <span className="text-2xl text-neutral-900 dark:text-white">
                  {d.label}
                </span>
                <span className="dark:text-dark-400 text-2xl text-neutral-400">
                  {d.text}
                </span>
              </div>
            ))}
          </div>

          <Link
            href={feature.docsUrl}
            target="_blank"
            className="dark:text-dark-300 inline-flex items-center gap-2 text-base text-neutral-500 transition hover:text-neutral-900 dark:hover:text-white"
          >
            Documentation
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 12L12 4M12 4H5M12 4V11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      <LandingFooter />
    </div>
  )
}
