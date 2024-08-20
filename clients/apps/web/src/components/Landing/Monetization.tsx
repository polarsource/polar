/* eslint-disable react/jsx-no-comment-textnodes */

'use client'

import { TypewriterText } from './TypewriterText'

export const Monetization = () => {
  // const circleRadius = 80

  return (
    <div className="flex flex-col gap-y-24 md:gap-y-32">
      <div className="flex flex-col gap-y-32">
        <div className="relative flex flex-col items-center gap-y-2 text-center md:gap-y-6">
          <h2 className="text-2xl leading-snug md:text-5xl">
            First class GitHub support
          </h2>
          <h3 className="dark:text-polar-400 text-xl leading-snug text-gray-400 md:text-4xl">
            Tap into more monetization options with crowdfunding
          </h3>
        </div>

        <div className="grid grid-cols-1 divide-x md:grid-cols-2">
          <div className="flex flex-col gap-y-12 pr-32">
            <div className="flex flex-col gap-y-4 text-center">
              <span className="font-mono text-xs uppercase tracking-wider dark:text-blue-500">
                Merchant of Record
              </span>
              <h3 className="text-3xl font-medium leading-snug">
                Issue Funding & Rewards
              </h3>
              <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
                Crowdfunded backlog or community bounties with seamless support
                to split funds with contributors.
              </p>
            </div>
            <picture>
              <source
                media="(prefers-color-scheme: dark)"
                srcSet={`/assets/landing/fund_dark.svg`}
              />
              <img
                className="dark:border-polar-700 rounded-2xl border border-gray-100"
                srcSet={`/assets/landing/fund.svg`}
                alt="Polar crowdfunding badge embedded on a GitHub issue"
              />
            </picture>
          </div>

          <div className="flex flex-col gap-y-12 pl-32">
            <div className="flex flex-col gap-y-4 text-center">
              <span className="font-mono text-xs uppercase tracking-wider dark:text-yellow-500">
                Merchant of Record
              </span>
              <h3 className="text-3xl font-medium leading-snug">
                Official GitHub Funding Option
              </h3>
              <p className="dark:text-polar-200 h-full leading-relaxed text-gray-500">
                Promote your Polar page on GitHub with a badge that links to
                your funding page.
              </p>
            </div>
            <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-6 rounded-2xl p-6 text-sm">
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
                        'serenityos',
                        'HDInnovations',
                        'emilwidlund',
                      ]}
                    />
                  </code>
                </pre>
              </div>
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
