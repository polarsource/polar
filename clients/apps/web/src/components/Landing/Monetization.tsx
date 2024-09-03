/* eslint-disable react/jsx-no-comment-textnodes */

'use client'

import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { TypewriterText } from './TypewriterText'

export const Monetization = () => {
  // const circleRadius = 80

  return (
    <div className="flex flex-col gap-y-24 md:gap-y-32">
      <div className="flex flex-col gap-y-24">
        <div className="relative flex flex-col items-center gap-y-2 text-center md:gap-y-4">
          <h2 className="text-3xl leading-snug md:text-5xl">
            Offer Community Funding & Rewards
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-x-16 gap-y-16 md:grid-cols-3 md:gap-y-24">
          <div className="flex flex-col justify-between gap-y-12">
            <div className="dark:bg-polar-950 dark:border-polar-700 flex h-full w-full flex-col gap-y-6 rounded-2xl border p-6 text-sm">
              <div className="flex flex-row items-center gap-x-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              </div>
              <div className="flex flex-col gap-y-2">
                <span className="dark:text-polar-500 font-mono">
                  // FUNDING.yaml
                </span>
                <pre>
                  <code className="language-yaml">
                    polar:{' '}
                    <TypewriterText
                      delay={1}
                      texts={[
                        'capawesome-team',
                        'fief-dev',
                        'LadybirdBrowser',
                        'emilwidlund',
                      ]}
                    />
                  </code>
                </pre>
              </div>
            </div>
            <div className="flex flex-col gap-y-2">
              <h3 className="text-lg font-medium leading-snug md:text-xl">
                Official GitHub Support
              </h3>
              <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
                Your Polar page can be displayed as an official funding option
                across your GitHub repositories.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-y-12">
            <motion.div
              className="grid grid-flow-col grid-cols-[repeat(32,minmax(0,1fr))] grid-rows-[repeat(7,minmax(0,1fr))] gap-1 rounded-3xl md:mt-9"
              whileInView="visible"
              initial="hidden"
              transition={{
                staggerChildren: 0.05,
                ease: 'easeInOut',
              }}
            >
              {Array(32 * 7)
                .fill(0)
                .map((_, i) => {
                  const active = Math.random() > 0.8
                  const activeClass = active
                    ? 'bg-blue-500 dark:bg-blue-500'
                    : 'hover:bg-blue-100 dark:hover:bg-blue-900'

                  return (
                    <div
                      key={i}
                      className={twMerge(
                        'dark:bg-polar-700 flex h-1.5 w-1.5 flex-col items-center justify-center rounded-full bg-gray-100',
                      )}
                    >
                      {active && (
                        <motion.span
                          className={twMerge(
                            'h-full w-full rounded-full',
                            activeClass,
                          )}
                          variants={{
                            hidden: { opacity: 0, scale: 0 },
                            visible: {
                              opacity: 1,
                              scale: 1,
                              transition: { duration: 0.5 },
                            },
                          }}
                        />
                      )}
                    </div>
                  )
                })}
            </motion.div>
            <div className="flex flex-col gap-y-2">
              <h3 className="text-lg font-medium leading-snug md:text-xl">
                Donations
              </h3>
              <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
                Get one-time donations of support from your community with ease.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-y-12">
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/assets/landing/fund_dark.svg`}
              />
              <img
                className="dark:border-polar-700 rounded-2xl border border-gray-100 md:mt-4"
                srcSet={`/assets/landing/fund_dark.svg`}
                alt="Polar crowdfunding badge embedded on a GitHub issue"
              />
            </picture>
            <div className="flex flex-col gap-y-2">
              <h3 className="text-lg font-medium leading-snug md:text-xl">
                Issue Funding & Rewards
              </h3>
              <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
                Turn issues into a crowdfunded backlog and share the funding
                with your contributors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* <Link
        className="relative hidden h-64 w-64 flex-col items-center justify-center rounded-full md:flex"
        href="https://polar.sh/polarsource/posts/github-supports-polar-in-funding-yaml"
      >
        <GitHubIcon
          className="text-black dark:text-white"
          width={60}
          height={60}
        />
        <div className="absolute inset-0 h-full w-full animate-spin fill-black text-xl font-semibold uppercase tracking-wide [animation-duration:32s] dark:fill-white">
          <svg
            x="0"
            y="0"
            viewBox="0 0 300 300"
            enableBackground="new 0 0 300 300"
            xmlSpace="preserve"
          >
            <defs>
              <path
                id="circlePath"
                d={`
          M 150, 150
          m -${circleRadius}, 0
          a ${circleRadius},${circleRadius} 0 0,1 ${circleRadius * 2},0
          a ${circleRadius},${circleRadius} 0 0,1 -${circleRadius * 2},0
          `}
              />
            </defs>
            <g>
              <text fontSize={12}>
                <textPath xlinkHref="#circlePath" textLength={80 * 6.1}>
                  Official Funding Option · Official Funding Option ·
                </textPath>
              </text>
            </g>
          </svg>
        </div>
      </Link> */}
    </div>
  )
}
